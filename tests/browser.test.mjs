import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '../.test-tools/node_modules/playwright/index.mjs';
const root=resolve(import.meta.dirname,'..');
const data=JSON.parse(await readFile(resolve(root,'places.json'),'utf8'));
const totals={'음식':39,'카페·디저트':9,'쇼핑':13,'관광':7,'호텔':1,'편의·서비스':8};
async function serve(){
 const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!path.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end('Not found');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return {server,url:`http://127.0.0.1:${server.address().port}`};
}
async function withBrowser(run){
 const {server,url}=await serve();let browser;
 try{browser=await chromium.launch();await run(browser,url);}finally{await browser?.close();await new Promise(r=>server.close(r));}
}
test('browser: list-only grouped snapshot, document scroll and no map requests at all viewports',()=>withBrowser(async(browser,url)=>{
 await mkdir(resolve(root,'test-results'),{recursive:true});
 for(const [width,height] of [[360,800],[390,844],[844,390],[1440,844]]){
  const page=await browser.newPage({viewport:{width,height}});const requests=[],errors=[];
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.geoCalls=0;navigator.geolocation.getCurrentPosition=()=>window.geoCalls++;navigator.geolocation.watchPosition=()=>window.geoCalls++;});
  await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.place-card').length===77);
  assert.equal(await page.locator('#results').isVisible(),true,'list must be visible by default');
  assert.equal(await page.title(),'오사카 장소 목록');
  assert.equal(await page.locator('#map, .leaflet-container, [role=tab], [role=tablist], #locate, #hotel').count(),0);
  assert.equal(await page.locator('link[href="styles.css?v=3"]').count(),1);
  assert.equal(await page.locator('script[src="app.js?v=3"]').count(),1);
  assert.equal(await page.locator('#count').textContent(),'77');
  assert.equal(await page.locator('.category-group').count(),6);
  for(const [category,count] of Object.entries(totals)){
   const group=page.locator('.category-group').filter({has:page.getByRole('heading',{name:`${category} ${count}`,exact:true})});
   assert.equal(await group.locator('.place-card').count(),count);
  }
  assert.deepEqual((await page.locator('.place-card').evaluateAll(els=>els.map(el=>el.dataset.id))).sort(),data.places.map(p=>p.id).sort());
  const links=await page.locator('.place-card').evaluateAll(cards=>cards.map(card=>({count:card.querySelectorAll('a').length,href:card.querySelector('a')?.href,target:card.querySelector('a')?.target,rel:card.querySelector('a')?.rel,height:card.querySelector('a')?.getBoundingClientRect().height,buttons:card.querySelectorAll('button').length})));
  for(const link of links){assert.equal(link.count,1);assert.match(link.href,/^https:\/\/www\.google\.com\/maps\?cid=\d+$/);assert.equal(link.target,'_blank');assert.match(link.rel,/noopener/);assert.ok(link.height>=44);assert.equal(link.buttons,0);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),true,'normal long document');
  assert.equal(await page.locator('#results').evaluate(el=>getComputedStyle(el).overflowY),'visible');
  assert.equal(await page.locator('header').evaluate(el=>getComputedStyle(el).position),'static');
  await page.locator('.place-card').last().scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>scrollY)>0);
  assert.equal(await page.locator('.place-card').last().isVisible(),true);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(root,`test-results/list-${width}.png`)});
  assert.equal(await page.evaluate(()=>window.geoCalls),0);
  assert.deepEqual(requests.filter(r=>!r.startsWith(url+'/')),[],'no external requests');
  assert.deepEqual(requests.filter(r=>/vendor|leaflet|tile|openstreetmap/i.test(r)),[]);
  assert.deepEqual(errors,[]);await page.close();
 }
}));
test('browser: real category, search and area filters retain counts and reset',()=>withBrowser(async(browser,url)=>{
 const page=await browser.newPage({viewport:{width:360,height:800}});
 await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.place-card').length===77);
 for(const [category,count] of Object.entries(totals)){
  const chip=page.locator(`[data-category="${category}"]`);
  assert.equal(await chip.locator('.chip-count').textContent(),String(count));
  await chip.click();assert.equal(await page.locator('.place-card').count(),count);
  assert.equal(await page.locator('.category-group').count(),1);
  assert.equal(await page.locator(`[data-category="${category}"]`).getAttribute('aria-pressed'),'true');
 }
 await page.locator('#reset').click();
 for(const place of data.places){
  const card=page.locator(`[data-id="${place.id}"]`);
  assert.equal(await card.locator('h3').textContent(),place.name);
  assert.ok((await card.locator('.metadata').textContent()).includes(place.kind));
  assert.equal(await card.locator('a').getAttribute('href'),place.mapsUrl);
  if(place.note)assert.equal(await card.locator('.note').textContent(),place.note);
 }
 assert.doesNotMatch(await page.locator('body').textContent(),/내 숙소|우리 숙소|숙박 예정/);
 await page.locator('#search').fill('우동 큐타로');assert.equal(await page.locator('.place-card').count(),1);
 assert.equal(await page.locator('[data-category="음식"] .chip-count').textContent(),'1');
 await page.locator('#reset').click();
 const area='신사이바시·호리에';await page.locator('#area').selectOption(area);
 const areaPlaces=data.places.filter(p=>p.area===area);
 assert.equal(await page.locator('.place-card').count(),areaPlaces.length);
 for(const category of Object.keys(totals)){
  assert.equal(await page.locator(`[data-category="${category}"] .chip-count`).textContent(),String(areaPlaces.filter(p=>p.category===category).length));
 }
 await page.locator('[data-category="카페·디저트"]').click();
 assert.equal(await page.locator('.place-card').count(),areaPlaces.filter(p=>p.category==='카페·디저트').length);
 await page.locator('#search').fill('없는검색어XYZ');assert.equal(await page.locator('.place-card').count(),0);
 assert.equal(await page.locator('#empty').isVisible(),true);
 assert.equal(await page.locator('.category-group').count(),0);
 await page.locator('#empty-reset').click();assert.equal(await page.locator('.place-card').count(),77);
 assert.equal(await page.locator('#area').inputValue(),'');assert.equal(await page.locator('#search').inputValue(),'');
 await page.locator('#area').selectOption('USJ·베이 에어리어');assert.equal(await page.locator('.place-card').count(),1);
 await page.close();
}));
test('browser: untrusted text stays text and unsafe URL uses Google Maps',()=>withBrowser(async(browser,url)=>{
 const page=await browser.newPage();
 const place={...data.places[0],name:'<img src=x onerror=alert(1)>',note:'<script>alert(1)</script>',mapsUrl:'javascript:alert(1)'};
 await page.route('**/places.json',r=>r.fulfill({json:{places:[place]}}));
 await page.goto(url);await page.waitForSelector('.place-card');
 assert.equal(await page.locator('.place-card img, .place-card script').count(),0);
 assert.equal(await page.locator('.place-title').textContent(),place.name);
 assert.equal(await page.locator('.note').textContent(),place.note);
 assert.match(await page.locator('.place-card a').getAttribute('href'),/^https:\/\/www\.google\.com\/maps\/search\//);
 await page.close();
}));
test('browser: data failure is visible, not a false empty result',()=>withBrowser(async(browser,url)=>{
 for(const response of [{status:503,body:'Unavailable'},{json:{places:null}}]){
  const page=await browser.newPage();await page.route('**/places.json',r=>r.fulfill(response));
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('#data-status').textContent.includes('불러오지 못했습니다'));
  assert.equal(await page.locator('#data-status').isVisible(),true);
  assert.equal(await page.locator('#empty').isVisible(),false);await page.close();
 }
}));
