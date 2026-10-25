export function viewportPlaces(places, filters = {}, full = false) {
  const valid = places.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (full || filters.query?.trim() || filters.category || filters.area) return valid;
  const central = valid.filter(p => p.area !== 'USJ·베이 에어리어');
  return central.length ? central : valid;
}
export function placeLinks(p) {
  const coordinates = `${p.lat},${p.lng}`;
  let place = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${coordinates}`)}`;
  try {
    const url = new URL(p.mapsUrl);
    if (url.protocol === 'https:' && ['www.google.com','maps.google.com','maps.app.goo.gl','goo.gl'].includes(url.hostname)) place = url.href;
  } catch { /* Missing or unsafe source URLs use a generated Maps query. */ }
  return {place,directions:`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coordinates)}`};
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
