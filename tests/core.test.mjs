import test from 'node:test';
import assert from 'node:assert/strict';
const fixture = [
 {id:'a',name:'라멘 A',originalName:'Ramen A',category:'음식',area:'난바',kind:'라멘',note:'현금',lat:34.66,lng:135.50},
 {id:'b',name:'커피 B',category:'카페·디저트',area:'우메다',kind:'커피',note:'',lat:34.70,lng:135.50},
 {id:'c',name:'USJ',category:'관광',area:'USJ·베이 에어리어',lat:34.66,lng:135.43},
 {id:'d',name:'호텔',category:'호텔',area:'난바',lat:34.66,lng:135.50}
];
test('single safe Google Maps link preserves source or falls back to search', async () => {
 const {placeLinks} = await import('../core.mjs');
 const links=placeLinks({...fixture[0],mapsUrl:'javascript:alert(1)'});
 assert.deepEqual(Object.keys(links),['place']);
 assert.ok(links.place.startsWith('https://www.google.com/maps/search/'));
 assert.equal(placeLinks({...fixture[0],mapsUrl:'https://maps.app.goo.gl/example'}).place,'https://maps.app.goo.gl/example');
 for(const mapsUrl of ['https://evil.example/maps','http://www.google.com/maps','not a URL']){
  assert.ok(placeLinks({...fixture[0],mapsUrl}).place.startsWith('https://www.google.com/maps/search/'));
 }
});
test('facet counts honor search and area but not selected category', async () => {
 const {categoryCounts,CATEGORIES} = await import('../core.mjs');
 assert.equal(CATEGORIES.length,6);
 assert.deepEqual(categoryCounts(fixture,{area:'난바',category:'음식'}),{'음식':1,'카페·디저트':0,'쇼핑':0,'관광':0,'호텔':1,'편의·서비스':0});
});
test('search combines category and area without mutating places', async () => {
 const {filterPlaces} = await import('../core.mjs');
 assert.deepEqual(filterPlaces(fixture,{query:' RAMEN ',category:'음식',area:'난바'}).map(p=>p.id),['a']);
 assert.deepEqual(filterPlaces(fixture,{query:'현금'}).map(p=>p.id),['a']);
 assert.deepEqual(filterPlaces(fixture,{query:'커피',area:'난바'}),[]);
 assert.equal(filterPlaces(fixture,{}).length,4);
 assert.equal(fixture.length,4);
});
