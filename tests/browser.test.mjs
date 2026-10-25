import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '../.test-tools/node_modules/playwright/index.mjs';
const root=resolve(import.meta.dirname,'..');
const places=[{id:'a',name:'테스트 라멘',originalName:'Ramen',category:'음식',area:'난바',kind:'라멘',note:'<img src=x onerror=alert(1)>',lat:34.66,lng:135.50},{id:'h',name:'테스트 호텔',category:'호텔',area:'난바',lat:34.66,lng:135.50},{id:'u',name:'USJ',category:'관광',area:'USJ·베이 에어리어',lat:34.665,lng:135.43}];
async function serve(){
 const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!path.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end('Not found');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return {server,url:`http://127.0.0.1:${server.address().port}`};
}
test('browser: exclusive full-height map/list tabs at every viewport',async()=>{
 const {server,url}=await serve();const browser=await chromium.launch();
 try{for(const [width,height] of [[360,800],[390,844],[412,915],[844,390],[1440,844]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.place-card').length===77);
  assert.equal(await page.locator('#results').isVisible(),false,'list must be hidden by default');
  const map=await page.locator('#map').boundingBox();
  assert.ok(map.width>=width-2,'map uses full width');
  assert.ok(map.height>=height*(height<500?.43:.58),'map keeps useful height');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth),true);
  for(const id of ['map-tab','list-tab'])assert.ok((await page.locator('#'+id).boundingBox()).height>=44);
  await page.locator('#list-tab').click();
  assert.equal(await page.locator('#results').isVisible(),true);
  assert.equal(await page.locator('.map-panel').isVisible(),false);
  assert.equal(await page.locator('#list-tab').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#results').evaluate(el=>el.scrollHeight>el.clientHeight && getComputedStyle(el).overflowY==='auto'),true);
  await page.locator('#map-tab').click();
  assert.equal(await page.locator('#results').isVisible(),false);
  assert.equal(await page.locator('#map-tab').getAttribute('aria-selected'),'true');
  await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
});
test('browser: list selection opens map and popup returns to highlighted card',async()=>{
 const {server,url}=await serve();const browser=await chromium.launch();
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:844}});
  await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.place-card').length===77);
  await page.locator('#list-tab').click();
  const card=page.locator('.place-card').nth(50);
  const id=await card.getAttribute('data-id');
  await card.locator('.place-title').click();
  assert.equal(await page.locator('#results').isVisible(),false,'selection switches to map');
  await page.waitForSelector('.leaflet-popup-content');
  await page.locator('#list-tab').click();
  await page.locator('#results').evaluate(el=>el.scrollTop=0);
  await page.locator('#map-tab').click();
  await page.locator('.popup-list').click();
  assert.equal(await page.locator('#results').isVisible(),true);
  assert.equal(await page.locator('.map-panel').isVisible(),false);
  const selected=page.locator('.place-card[data-selected=true]');
  assert.equal(await selected.getAttribute('data-id'),id);
  assert.equal(await selected.locator('button').evaluate(el=>el===document.activeElement),true);
  assert.equal(await selected.evaluate(el=>{const r=el.getBoundingClientRect(),list=document.querySelector('#results').getBoundingClientRect(),heading=document.querySelector('.results-heading').getBoundingClientRect();return r.top>=heading.bottom-1 && r.top<list.bottom;}),true);
  assert.equal(await page.evaluate(()=>scrollY),0);
  assert.equal(await page.locator('.place-card').count(),77);
  await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
});
test('browser: supplied snapshot renders 77 cards at both viewports without horizontal overflow',async()=>{
 const {server,url}=await serve();const browser=await chromium.launch();
 try {await mkdir(resolve(root,'test-results'),{recursive:true});
 for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.place-card').length===77);
 assert.equal(await page.locator('#count').textContent(),'77');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('.leaflet-container').count(),1);
 await page.waitForFunction(()=>{const tiles=[...document.querySelectorAll('.leaflet-tile')];return tiles.length>0 && tiles.every(tile=>tile.complete && tile.naturalWidth>0 && tile.classList.contains('leaflet-tile-loaded'));},{},{timeout:20000});
 console.log(`Loaded real map tiles at ${width}px:`,await page.locator('.leaflet-tile-loaded').count());
 await page.screenshot({path:resolve(root,`test-results/osaka-${width}.png`)});
 assert.deepEqual(errors,[]);await page.close();
 }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
test('browser: real Leaflet clusters, card popup, selection keeps filters, USJ and explicit geolocation',async()=>{
 const {server,url}=await serve();const browser=await chromium.launch();
 try{const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/places.json',r=>r.fulfill({json:{sourceCount:3,places}}));
 await page.route('**/tile.openstreetmap.org/**',r=>r.abort());
 await page.addInitScript(()=>{window.geoCalls=0;navigator.geolocation.getCurrentPosition=()=>window.geoCalls++;});
 await page.goto(url);await page.waitForSelector('.marker-cluster',{timeout:3000});
 assert.equal(await page.evaluate(()=>window.geoCalls),0);
 await page.locator('#list-tab').click();await page.locator('.place-title').first().click();await page.waitForSelector('.leaflet-popup-content');
 assert.match(await page.locator('.leaflet-popup-content').textContent(),/테스트 라멘/);
 assert.equal(await page.locator('.place-card').count(),3);
 assert.equal(await page.locator('.leaflet-popup-content img').count(),0);
 await page.locator('.leaflet-popup-close-button').click();
 await page.locator('#area').selectOption('USJ·베이 에어리어');
 await page.locator('#list-tab').click();await page.locator('.place-title').click();await page.waitForSelector('.leaflet-popup-content');
 assert.match(await page.locator('.leaflet-popup-content').textContent(),/USJ/);
 assert.equal(await page.locator('#area').inputValue(),'USJ·베이 에어리어');
 await page.locator('#locate').click();assert.equal(await page.evaluate(()=>window.geoCalls),1);
 assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
test('browser: mobile/desktop filters, safe text, zero state and map failure retain usable list',async()=>{
 const {server,url}=await serve(); const browser=await chromium.launch();
 try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:844}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/places.json',r=>r.fulfill({json:{sourceCount:3,sourceLabel:'Google Maps 저장 목록',places,excluded:[]}}));
 await page.route('**/vendor/**',r=>r.abort());
 await page.goto(url);
 await page.locator('#list-tab').click();await page.waitForSelector('.place-card',{timeout:3000});
 assert.equal(await page.locator('.place-card').count(),3);
 assert.equal(await page.locator('.place-card img').count(),0);
 assert.ok(await page.locator('#map-status').textContent());
 await page.locator('#search').fill('없는검색어');assert.equal(await page.locator('.place-card').count(),0);
 assert.equal(await page.locator('#empty').isVisible(),true);
 await page.locator('#reset').click();assert.equal(await page.locator('.place-card').count(),3);
 await page.locator('#hotel').click();assert.equal(await page.locator('.place-card').count(),1);
 assert.match(await page.locator('.place-card').textContent(),/호텔/);
 await page.locator('#reset').click();await page.locator('#area').selectOption('USJ·베이 에어리어');
 assert.equal(await page.locator('.place-card').count(),1);
 assert.ok(await page.locator('.place-card a').first().getAttribute('href'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
});
