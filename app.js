import {CATEGORIES, filterPlaces, categoryCounts, placeLinks, viewportPlaces} from './core.mjs';
const $ = id => document.getElementById(id);
const colors = ['var(--food)','var(--cafe)','var(--shop)','var(--sight)','var(--hotel)','var(--service)'];
let places = [], visible = [], selected = null;
const filters = {query:'',category:'',area:''};
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function links(p, className = 'place-links') {
  const row = node('div',undefined,className), urls = placeLinks(p);
  for (const [label,url] of [['Google Maps ↗',urls.place],['길찾기 ↗',urls.directions]]) {
    const a = node('a',label); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.setAttribute('aria-label',`${p.name} ${label} (새 탭)`); row.append(a);
  }
  return row;
}
let map, clusters, locationMarker;
const markers = new Map();
function highlight(p, reveal = false) {
  selected = p.id;
  for (const card of $('list').children) {
    card.dataset.selected = String(card.dataset.id === selected);
    if (reveal && card.dataset.id === selected) {
      if (matchMedia('(min-width:701px)').matches) $('results').scrollTo({top:card.offsetTop-$('results').offsetTop-65,behavior:'auto'});
    }
  }
}
function selectPlace(p) {
  highlight(p);
  const marker = markers.get(p.id);
  if (!map || !marker) return;
  if (matchMedia('(max-width:700px)').matches) window.scrollTo({top:document.querySelector('.map-panel').offsetTop,behavior:'auto'});
  clusters.zoomToShowLayer(marker,()=>{if(selected===p.id)marker.openPopup();});
}
function fit(full = false) {
  if (!map) return;
  const points=viewportPlaces(visible,filters,full);
  if(points.length)map.fitBounds(points.map(p=>[p.lat,p.lng]),{padding:[35,35],maxZoom:16,animate:false});
}
function drawMarkers() {
  if(!map || !clusters)return;
  clusters.clearLayers();markers.clear();
  for(const p of viewportPlaces(visible,{},true)) {
    const pin=node('span',CATEGORIES.indexOf(p.category)===4?'H':'','pin');pin.style.setProperty('--category',colors[CATEGORIES.indexOf(p.category)] || 'var(--accent)');
    const marker=L.marker([p.lat,p.lng],{icon:L.divIcon({html:pin,className:'place-marker',iconSize:[28,28],iconAnchor:[14,14]}),title:p.name,alt:p.name,keyboard:true});
    const popup=node('div');popup.append(node('p',[p.category,p.area].filter(Boolean).join(' · '),'metadata'),node('h3',p.name));
    if(p.note)popup.append(node('p',p.note,'note'));
    if(p.address)popup.append(node('p',p.address,'address'));
    popup.append(links(p,'popup-links'));
    const reveal=node('button','목록에서 보기','popup-list');reveal.type='button';
    reveal.addEventListener('click',()=>{
      highlight(p,true);const card=[...$('list').children].find(c=>c.dataset.id===p.id);
      if(card){if(matchMedia('(max-width:700px)').matches)window.scrollTo({top:card.getBoundingClientRect().top+scrollY-12,behavior:'auto'});card.querySelector('button').focus({preventScroll:true});}
    });popup.append(reveal);
    marker.bindPopup(popup);marker.on('click',()=>highlight(p,true));marker.on('popupopen',()=>highlight(p,true));
    markers.set(p.id,marker);clusters.addLayer(marker);
  }
  fit();
}
function setupMap() {
  try {
    if(!window.L || !L.markerClusterGroup)throw Error('Map library unavailable');
    map=L.map('map',{zoomControl:true,scrollWheelZoom:false,fadeAnimation:false}).setView([34.682,135.501],13);
    const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    tiles.on('tileerror',()=>mapStatus('배경 지도를 불러오지 못했습니다. 장소 목록과 Google Maps 링크는 계속 사용할 수 있어요.'));
    clusters=L.markerClusterGroup({maxClusterRadius:42,spiderfyOnMaxZoom:true,showCoverageOnHover:false,animate:!matchMedia('(prefers-reduced-motion:reduce)').matches}).addTo(map);
    mapStatus('');
    new ResizeObserver(()=>map.invalidateSize({pan:false})).observe($('map'));
  } catch {
    mapStatus('지도를 불러오지 못했습니다. 장소 목록과 Google Maps 링크를 이용해 주세요.');
    for(const id of ['fit','full','locate'])$(id).disabled=true;
  }
}
$('fit').addEventListener('click',()=>fit(true));
$('full').addEventListener('click',()=>{
  if(!map)return;
  const points=viewportPlaces(places,{},true);if(points.length)map.fitBounds(points.map(p=>[p.lat,p.lng]),{padding:[35,35],maxZoom:16,animate:false});
});
$('locate').addEventListener('click',()=>{
  if(!map || !navigator.geolocation){mapStatus('이 브라우저에서는 현재 위치를 사용할 수 없습니다.');return;}
  mapStatus('현재 위치를 확인하는 중…');
  navigator.geolocation.getCurrentPosition(position=>{
    const point=[position.coords.latitude,position.coords.longitude];
    if(locationMarker)map.removeLayer(locationMarker);
    locationMarker=L.circleMarker(point,{radius:8,color:'#fff',weight:3,fillColor:'#286dad',fillOpacity:1}).addTo(map).bindTooltip('현재 위치');
    map.setView(point,15);mapStatus('현재 위치를 표시했습니다. 앱은 위치를 별도로 저장하지 않습니다.');
  },()=>mapStatus('현재 위치를 확인할 수 없습니다. 위치 권한이나 연결 상태를 확인해 주세요.'),{enableHighAccuracy:false,timeout:10000,maximumAge:60000});
});
function render() {
  visible = filterPlaces(places,filters);
  const counts = categoryCounts(places,filters);
  $('categories').replaceChildren();
  for (const c of ['',...CATEGORIES]) {
    const button = node('button',undefined,'chip'); button.type = 'button'; button.dataset.category = c; button.setAttribute('aria-pressed',String(filters.category === c));
    if(c){const dot=node('span',undefined,'dot');dot.style.setProperty('--category',colors[CATEGORIES.indexOf(c)]);button.append(dot);}
    button.append(node('span',c || '전체'),node('span',String(c ? counts[c] : filterPlaces(places,{...filters,category:''}).length),'chip-count'));
    button.addEventListener('click',()=>{filters.category=c;render();$('categories').querySelector(`[data-category="${c}"]`)?.focus({preventScroll:true});});
    $('categories').append(button);
  }
  $('count').textContent = `${visible.length}`;
  $('filter-label').textContent = [filters.area,filters.category].filter(Boolean).join(' · ') || '전체';
  $('empty').hidden = visible.length !== 0;
  $('list').replaceChildren();
  for(const p of visible){
    const card=node('article',undefined,'place-card'); card.dataset.id=p.id; card.dataset.selected=String(p.id===selected);
    const meta=node('p',undefined,'metadata'); const dot=node('span',undefined,'dot'); dot.style.setProperty('--category',colors[CATEGORIES.indexOf(p.category)] || 'var(--accent)');
    meta.append(dot,node('span',[p.category,p.area,p.kind].filter(Boolean).join(' · ')));
    const title=node('button',p.name,'place-title');title.type='button';title.setAttribute('aria-label',`${p.name} 지도에서 보기`);title.addEventListener('click',()=>selectPlace(p));
    card.append(meta,title);
    if(p.originalName && p.originalName!==p.name)card.append(node('p',p.originalName,'place-original'));
    if(p.note)card.append(node('p',p.note,'note'));
    if(p.address)card.append(node('p',p.address,'address'));
    card.append(links(p));$('list').append(card);
  }
  drawMarkers();
}
function reset() { Object.assign(filters,{query:'',category:'',area:''});$('search').value='';$('area').value='';selected=null;render(); }
$('search').addEventListener('input',e=>{filters.query=e.target.value;render();});
$('area').addEventListener('change',e=>{filters.area=e.target.value;render();});
$('reset').addEventListener('click',reset);$('empty-reset').addEventListener('click',reset);
$('hotel').addEventListener('click',()=>{Object.assign(filters,{query:'',category:'호텔',area:''});$('search').value='';$('area').value='';render();if(visible[0])selectPlace(visible[0]);});
function mapStatus(text) {$('map-status').textContent=text;$('map-status').hidden=!text;}
mapStatus('지도를 불러오지 못했습니다. 아래 장소 목록과 Google Maps 링크를 이용해 주세요.');
async function start(){
  try{
    const response=await fetch('./places.json');if(!response.ok)throw Error('Data unavailable');
    const data=await response.json();if(!Array.isArray(data.places))throw Error('Invalid data');
    places=data.places;$('source').textContent=data.sourceLabel || 'Google Maps 저장 목록';
    const areas=[...new Set(places.map(p=>p.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    for(const area of areas){const option=node('option',area);option.value=area;$('area').append(option);}
    $('data-status').hidden=true;setupMap();render();
  }catch{$('data-status').textContent='장소를 불러오지 못했습니다. 연결을 확인한 뒤 새로고침해 주세요.';}
}
start();
