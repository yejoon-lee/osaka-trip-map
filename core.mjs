export function placeLinks(p) {
  const coordinates = `${p.lat},${p.lng}`;
  let place = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${coordinates}`)}`;
  try {
    const url = new URL(p.mapsUrl);
    if (url.protocol === 'https:' && ['www.google.com','maps.google.com','maps.app.goo.gl','goo.gl'].includes(url.hostname)) place = url.href;
  } catch { /* Missing or unsafe source URLs use a generated Maps query. */ }
  return {place};
}
function validCoordinates(p) {
  return p && Number.isFinite(p.lat) && Math.abs(p.lat)<=90 && Number.isFinite(p.lng) && Math.abs(p.lng)<=180;
}
export function distanceMeters(a,b) {
  if (!validCoordinates(a) || !validCoordinates(b)) return null;
  const rad=degrees=>degrees*Math.PI/180;
  const h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;
  return 6371008.8*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}
export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '거리 미확인';
  return meters<1000 ? `직선 ${Math.round(meters)} m` : `직선 ${(meters/1000).toFixed(1)} km`;
}
export function sortByDistance(places,location) {
  if (!validCoordinates(location)) return [...places];
  return places.map(p=>({p,distance:distanceMeters(location,p)??Infinity})).sort((a,b)=>
    a.distance-b.distance || String(a.p.id).localeCompare(String(b.p.id),'en')).map(({p})=>p);
}
export const CATEGORIES = ['음식','카페·디저트','쇼핑','관광','호텔','편의·서비스'];
export function categoryCounts(places, filters = {}) {
  const counts = Object.fromEntries(CATEGORIES.map(c => [c,0]));
  for (const p of filterPlaces(places,{...filters,category:''})) if (p.category in counts) counts[p.category]++;
  return counts;
}
export function filterPlaces(places, {query = '', category = '', area = ''} = {}) {
  const terms = query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return places.filter(p => (!category || p.category === category) && (!area || p.area === area) &&
    terms.every(term => [p.name,p.originalName,p.kind,p.note,p.address,p.area,p.category].filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase().includes(term)));
}
