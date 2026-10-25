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
 await mkdir(resolve(root,'test-results'),{recursive:true});
 const {server,url}=await serve();let browser;
 try{browser=await chromium.launch();await run(browser,url);}finally{await browser?.close();await new Promise(r=>server.close(r));}
}
test('browser: explicit location, global near order, filters, refresh and clear without storage or network leaks',()=>withBrowser(async(browser,url)=>{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>{
  window.geoCalls=0;window.writes=[];
  Storage.prototype.setItem=function(...args){window.writes.push(args);};
  indexedDB.open=(...args)=>{window.writes.push(['indexedDB',...args]);throw Error('Persistence forbidden');};
  Object.defineProperty(document,'cookie',{get:()=>'',set:value=>window.writes.push(['cookie',value])});
  history.pushState=(...args)=>window.writes.push(['history',...args]);
  history.replaceState=(...args)=>window.writes.push(['history',...args]);
  navigator.geolocation.getCurrentPosition=success=>{window.geoCalls++;success({coords:{latitude:34.68123456,longitude:135.51123456,accuracy:18},timestamp:1792886400000});};
  navigator.geolocation.watchPosition=()=>{throw Error('Background geolocation forbidden');};
 });
 await page.goto(url);await page.waitForSelector('.place-card');
 assert.equal(await page.locator('#locate').count(),1);
 assert.equal(await page.evaluate(()=>window.geoCalls),0);
 await page.locator('#sort').selectOption('distance');
 assert.equal(await page.evaluate(()=>window.geoCalls),0);
 assert.match(await page.locator('#sort-help').textContent(),/내 위치/);
 assert.equal(await page.locator('.category-group').count(),6);
 await page.locator('#locate').click();
 assert.match(await page.locator('#location-status').textContent(),/34\.681235.*135\.511235/);
 assert.match(await page.locator('#location-status').textContent(),/18 m.*확인/);
 assert.match(await page.locator('#my-location-link').getAttribute('href'),/34.68123456/);
 assert.equal(await page.locator('.category-group').count(),0,'distance order cannot be grouped by category');
 const {sortByDistance,filterPlaces}=await import('../core.mjs');
 const origin={lat:34.68123456,lng:135.51123456};
 const ids=()=>page.locator('.place-card').evaluateAll(cards=>cards.map(c=>c.dataset.id));
 assert.deepEqual(await ids(),sortByDistance(data.places,origin).map(p=>p.id));
 assert.match(await page.locator('.distance').first().textContent(),/직선 .* (m|km)/);
 const area='신사이바시·호리에';await page.locator('#area').selectOption(area);
 await page.locator('[data-category="음식"]').click();await page.locator('#search').fill('우동');
 assert.deepEqual(await ids(),sortByDistance(filterPlaces(data.places,{area,category:'음식',query:'우동'}),origin).map(p=>p.id));
 await page.locator('#reset').click();
 await page.locator('#refresh-location').click();assert.equal(await page.evaluate(()=>window.geoCalls),2);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:resolve(root,'test-results/location-390.png')});
 await page.locator('#clear-location').click();
 assert.equal(await page.locator('.distance').count(),0);
 assert.equal(await page.locator('#my-location-link').isVisible(),false);
 assert.equal(await page.locator('#my-location-link').getAttribute('href'),null);
 assert.equal(await page.locator('#sort').inputValue(),'category');
 assert.equal(await page.locator('.place-card').count(),77);
 assert.doesNotMatch(await page.locator('#location-status').textContent(),/34\.681/);
 assert.deepEqual(await page.evaluate(()=>window.writes),[]);
 assert.deepEqual(requests.filter(r=>!r.startsWith(url+'/') || /34\.681|135\.511/.test(decodeURIComponent(r))),[]);
 await page.reload();await page.waitForSelector('.place-card');
 assert.equal(await page.evaluate(()=>window.geoCalls),0);
 assert.equal(await page.locator('.distance').count(),0);
 await page.close();
}));
test('browser: permission, unavailable, timeout and unsupported leave list usable; clear ignores late callbacks',()=>withBrowser(async(browser,url)=>{
 for(const [code,message] of [[1,'권한'],[2,'확인할 수 없습니다'],[3,'시간'],[0,'지원']]){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(code=>{
   if(code===0)Object.defineProperty(navigator,'geolocation',{value:undefined});
   else navigator.geolocation.getCurrentPosition=(_,failure)=>failure({code});
  },code);
  await page.goto(url);await page.waitForSelector('.place-card');
  await page.locator('#locate').click();
  assert.ok((await page.locator('#location-status').textContent()).includes(message));
  assert.match(await page.locator('#location-status').textContent(),/외부 브라우저/);
  assert.equal(await page.locator('#locate').isEnabled(),true);
  await page.locator('#search').fill('우동 큐타로');assert.equal(await page.locator('.place-card').count(),1);
  assert.equal(await page.locator('.distance').count(),0);await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.addInitScript(()=>{navigator.geolocation.getCurrentPosition=success=>{window.lateSuccess=success;};});
 await page.goto(url);await page.waitForSelector('.place-card');await page.locator('#locate').click();
 await page.locator('#clear-location').click();
 await page.evaluate(()=>window.lateSuccess({coords:{latitude:34.6,longitude:135.5,accuracy:10},timestamp:Date.now()}));
 assert.equal(await page.locator('.distance').count(),0);
 assert.equal(await page.locator('#my-location-link').getAttribute('href'),null);await page.close();
}));
test('browser: optional enrichment shows reviewed evidence separately, never upgrades unavailable reviews',()=>withBrowser(async(browser,url)=>{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const [first,second,third]=data.places;
 const common={description:'설명 테스트 <img src=x>',reviewSummary:'한국어 리뷰 요약 테스트',reviewStatus:'reviewed',sampleSize:3,checkedAt:'2026-10-25',sourceUrl:first.mapsUrl,rating:4.2,reviewCount:100};
 await page.route('**/enrichment.json',r=>r.fulfill({json:{places:{
  [first.id]:common,
  [second.id]:{...common,description:'리뷰 미확인 설명',reviewStatus:'unavailable',sampleSize:0,reviewSummary:'표시하면 안 되는 미확인 요약'},
  [third.id]:{...common,sourceUrl:'javascript:alert(1)',sampleSize:0,rating:null,reviewCount:null}
 }}}));
 await page.goto(url);await page.waitForSelector('.review-details');
 const card=page.locator(`[data-id="${first.id}"]`);
 assert.equal(await card.locator('details').getAttribute('open'),null);
 await card.locator('summary').click();
 assert.equal(await card.locator('.description').textContent(),common.description);
 assert.equal(await card.locator('.review-summary').textContent(),common.reviewSummary);
 assert.match(await card.locator('.review-metadata').textContent(),/표시된 리뷰 3개 참고.*확인일.*2026-10-25/);
 assert.match(await card.locator('.review-metadata').textContent(),/4.2.*100/);
 assert.equal(await card.locator('.review-source').getAttribute('href'),first.mapsUrl);
 if(first.note) assert.equal(await card.locator('.note').textContent(),first.note);
 assert.equal(await card.locator('img').count(),0);
 const unavailable=page.locator(`[data-id="${second.id}"]`);
 await unavailable.locator('summary').click();
 assert.match(await unavailable.textContent(),/Google Maps 리뷰 미확인/);
 assert.equal(await unavailable.locator('.description').textContent(),'리뷰 미확인 설명');
 assert.doesNotMatch(await unavailable.textContent(),/표시하면 안 되는|표시된 리뷰/);
 const unsafe=page.locator(`[data-id="${third.id}"]`);
 assert.equal(await unsafe.locator('a[href^="javascript:"]').count(),0);
 assert.equal(await unsafe.locator('.review-source').count(),0);
 assert.match(await unsafe.textContent(),/Google Maps 리뷰 미확인/);
 assert.equal(await page.locator('.place-card').count(),77);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await card.scrollIntoViewIfNeeded();
 await page.screenshot({path:resolve(root,'test-results/reviews-390.png')});await page.close();
 for(const response of [{status:404,body:'Missing'},{status:503,body:'Unavailable'},{json:{places:null}},{body:'not json'}]){
  const fallback=await browser.newPage();await fallback.route('**/enrichment.json',r=>r.fulfill(response));
  await fallback.goto(url);await fallback.waitForFunction(()=>document.querySelectorAll('.place-card').length===77);
  assert.equal(await fallback.locator('.review-summary').count(),0);
  assert.match(await fallback.locator('.place-card').first().textContent(),/Google Maps 리뷰 미확인/);await fallback.close();
 }
}));
test('browser: list-only grouped snapshot, document scroll and no map requests at all viewports',()=>withBrowser(async(browser,url)=>{
 await mkdir(resolve(root,'test-results'),{recursive:true});
 for(const [width,height] of [[360,800],[390,844],[844,390],[1440,844]]){
  const page=await browser.newPage({viewport:{width,height}});const requests=[],errors=[];
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.geoCalls=0;navigator.geolocation.getCurrentPosition=()=>window.geoCalls++;navigator.geolocation.watchPosition=()=>window.geoCalls++;});
  await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.place-card').length===77);
  assert.equal(await page.locator('#results').isVisible(),true,'list must be visible by default');
  assert.equal(await page.title(),'오사카 장소 목록');
  assert.equal(await page.locator('#map, .leaflet-container, [role=tab], [role=tablist], #hotel').count(),0);
  assert.equal(await page.locator('link[href="styles.css?v=4"]').count(),1);
  assert.equal(await page.locator('script[src="app.js?v=4"]').count(),1);
  assert.equal(await page.locator('#count').textContent(),'77');
  assert.equal(await page.locator('.category-group').count(),6);
  for(const [category,count] of Object.entries(totals)){
   const group=page.locator('.category-group').filter({has:page.getByRole('heading',{name:`${category} ${count}`,exact:true})});
   assert.equal(await group.locator('.place-card').count(),count);
  }
  assert.deepEqual((await page.locator('.place-card').evaluateAll(els=>els.map(el=>el.dataset.id))).sort(),data.places.map(p=>p.id).sort());
  const links=await page.locator('.place-card').evaluateAll(cards=>cards.map(card=>({count:card.querySelectorAll('.place-link').length,href:card.querySelector('.place-link')?.href,target:card.querySelector('.place-link')?.target,rel:card.querySelector('.place-link')?.rel,height:card.querySelector('.place-link')?.getBoundingClientRect().height,buttons:card.querySelectorAll('button').length})));
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
  assert.equal(await card.locator('.place-link').getAttribute('href'),place.mapsUrl);
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
 assert.match(await page.locator('.place-card .place-link').getAttribute('href'),/^https:\/\/www\.google\.com\/maps\/search\//);
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
