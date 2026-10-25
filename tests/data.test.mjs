import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../places.json',import.meta.url),'utf8'));
test('complete snapshot reconciles included and excluded entries',()=>{
 assert.equal(data.sourceCount,79);
 assert.equal(data.places.length,77);
 assert.equal(data.places.length+data.excluded.length,data.sourceCount);
 assert.equal(new Set(data.places.map(p=>p.id)).size,data.places.length);
});
test('every listed place has source coordinates and exact place link',()=>{
 for(const p of data.places){
  assert.ok(p.name && p.originalName && p.kind && p.area,p.id);
  assert.equal(typeof p.address,'string'); // Source omits some addresses; do not invent.
  assert.ok(Number.isFinite(p.lat)&&p.lat>34.60&&p.lat<34.75,p.name);
  assert.ok(Number.isFinite(p.lng)&&p.lng>135.40&&p.lng<135.56,p.name);
  assert.match(p.mapsUrl,/^https:\/\/www\.google\.com\/maps\?cid=\d+$/);
 }
});
test('categories contain exactly the reviewed snapshot totals',()=>{
 const counts={};for(const p of data.places)counts[p.category]=(counts[p.category]||0)+1;
 assert.deepEqual(counts,{'카페·디저트':9,'편의·서비스':8,'쇼핑':13,'음식':39,'관광':7,'호텔':1});
});
test('hotel is ordinary hotel; out-of-scope places excluded',()=>{
 const hotels=data.places.filter(p=>p.category==='호텔');
 assert.equal(hotels.length,1);assert.equal(hotels[0].note,'');
 assert.ok(!data.places.some(p=>['간사이 국제공항','가모 강'].includes(p.name)));
 assert.equal(data.places.filter(p=>p.area==='USJ·베이 에어리어').length,1);
 assert.ok(!JSON.stringify(data).includes('숙소'));
});
