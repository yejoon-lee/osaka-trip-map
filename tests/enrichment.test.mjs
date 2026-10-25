import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
test('every original place has sourced review enrichment without personal metadata',()=>{
 const path=new URL('../enrichment.json',import.meta.url);
 assert.ok(existsSync(path),'review enrichment must be supplied');
 const text=readFileSync(path,'utf8'),data=JSON.parse(text);
 const original=JSON.parse(readFileSync(new URL('../places.json',import.meta.url),'utf8')).places;
 assert.deepEqual(Object.keys(data.places).sort(),original.map(p=>p.id).sort());
 let samples=0;
 for(const p of original){const e=data.places[p.id];
  assert.equal(e.sourceUrl,p.mapsUrl);assert.equal(e.reviewStatus,'reviewed');
  assert.ok(e.description.length>10&&e.reviewSummary.length>20);
  assert.ok(Number.isInteger(e.sampleSize)&&e.sampleSize>0);samples+=e.sampleSize;
  assert.match(e.checkedAt,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(e.rating===null||(e.rating>=0&&e.rating<=5));
 }
 assert.equal(samples,232);
 for(const secret of ['R8Vr3jY_CQWVJCFvhNrv_Q','102639875874153676795','/Users/','lh3.googleusercontent.com'])assert.ok(!text.includes(secret));
});
