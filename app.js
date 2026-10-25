import {CATEGORIES, filterPlaces, categoryCounts, placeLinks, distanceMeters, formatDistance, sortByDistance} from './core.mjs?v=4';
const $ = id => document.getElementById(id);
let places = [];
let enrichment = {};
let location = null;
let locationRequest = 0;
const filters = {query:'',category:'',area:''};
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function render() {
  const near = $('sort').value==='distance' && location;
  const filtered = filterPlaces(places,filters);
  const visible = near ? sortByDistance(filtered,location) : filtered;
  $('sort-help').textContent = $('sort').value==='distance' && !location ? '가까운 순을 보려면 내 위치 버튼을 눌러 주세요. 현재는 카테고리순입니다.' : '거리는 직선거리이며 도보 경로·시간이 아닙니다.';
  const counts = categoryCounts(places,filters);
  $('categories').replaceChildren();
  for (const c of ['',...CATEGORIES]) {
    const button = node('button',undefined,'chip');
    button.type = 'button'; button.dataset.category = c;
    button.setAttribute('aria-pressed',String(filters.category === c));
    button.append(node('span',c || '전체'),node('span',String(c ? counts[c] : Object.values(counts).reduce((sum,n)=>sum+n,0)),'chip-count'));
    button.addEventListener('click',()=>{
      filters.category=c;render();
      [...$('categories').children].find(el=>el.dataset.category===c)?.focus({preventScroll:true});
    });
    $('categories').append(button);
  }
  $('count').textContent = String(visible.length);
  $('filter-label').textContent = [filters.area,filters.category].filter(Boolean).join(' · ') || '전체';
  $('empty').hidden = visible.length !== 0;
  $('list').replaceChildren();
  for (const category of near ? ['가까운 순'] : CATEGORIES) {
    const members=near ? visible : visible.filter(p=>p.category===category);
    if (!members.length) continue;
    const group=node('section',undefined,near ? 'distance-group' : 'category-group');
    const heading=node('h2',`${category} ${members.length}`);
    heading.id=`category-${CATEGORIES.indexOf(category)}`;
    group.setAttribute('aria-labelledby',heading.id);group.append(heading);
    for (const p of members) {
      const card=node('article',undefined,'place-card');card.dataset.id=p.id;
      card.append(node('h3',p.name,'place-title'),node('p',[p.area,p.kind].filter(Boolean).join(' · '),'metadata'));
      if(location)card.append(node('p',formatDistance(distanceMeters(location,p)),'distance'));
      if(p.originalName && p.originalName!==p.name)card.append(node('p',p.originalName,'place-original'));
      if(p.note)card.append(node('p','내 저장 메모','note-label'),node('p',p.note,'note'));
      appendReview(card,p);
      if(p.address)card.append(node('p',p.address,'address'));
      const link=node('a','Google Maps에서 보기 ↗','place-link');
      link.href=placeLinks(p).place;link.target='_blank';link.rel='noopener noreferrer';
      link.setAttribute('aria-label',`${p.name} Google Maps에서 보기 (새 탭)`);
      card.append(link);group.append(card);
    }
    $('list').append(group);
  }
}
function appendReview(card,p) {
  const entry=enrichment[p.id];
  const text=value=>typeof value==='string' ? value.trim() : '';
  if(!entry || typeof entry!=='object') {
    card.append(node('p','Google Maps 리뷰 미확인','review-status'));return;
  }
  let source='';
  try {
    const url=new URL(entry.sourceUrl);
    if(url.protocol==='https:' && ['www.google.com','maps.google.com','maps.app.goo.gl','goo.gl'].includes(url.hostname))source=url.href;
  } catch { /* Unsafe sources are not linked or treated as verified. */ }
  const reviewed=entry.reviewStatus==='reviewed' && source && text(entry.reviewSummary) && /^\d{4}-\d{2}-\d{2}/.test(text(entry.checkedAt));
  const description=text(entry.description);
  if(!description && !reviewed){card.append(node('p','Google Maps 리뷰 미확인','review-status'));return;}
  const details=node('details',undefined,'review-details');
  details.append(node('summary',reviewed ? '상세 / 리뷰' : '상세 · Google Maps 리뷰 미확인'));
  if(description)details.append(node('p',description,'description'));
  if(reviewed) {
    details.append(node('p',text(entry.reviewSummary),'review-summary'));
    const sample=Number.isInteger(entry.sampleSize) && entry.sampleSize>0 ? `표시된 리뷰 ${entry.sampleSize}개 참고` : '표시된 리뷰 참고 (표본 수 미기록)';
    const metadata=[sample,`확인일 ${text(entry.checkedAt)}`];
    if(Number.isFinite(entry.rating) && entry.rating>=0 && entry.rating<=5)metadata.push(`평점 ${entry.rating}`);
    if(Number.isInteger(entry.reviewCount) && entry.reviewCount>=0)metadata.push(`전체 리뷰 ${entry.reviewCount}개`);
    details.append(node('p',metadata.join(' · '),'review-metadata'));
    const link=node('a','Google Maps 리뷰 출처 ↗','review-source');
    link.href=source;link.target='_blank';link.rel='noopener noreferrer';details.append(link);
  }
  card.append(details);
}
async function loadEnrichment() {
  try {
    const response=await fetch('./enrichment.json');
    if(!response.ok)return;
    const data=await response.json();
    if(!data.places || typeof data.places!=='object' || Array.isArray(data.places))return;
    enrichment=data.places;render();
  } catch { /* Optional supplemental data must never block the original list. */ }
}
function reset() {
  Object.assign(filters,{query:'',category:'',area:''});
  $('search').value='';$('area').value='';render();
}
$('search').addEventListener('input',e=>{filters.query=e.target.value;render();});
$('area').addEventListener('change',e=>{filters.area=e.target.value;render();});
$('reset').addEventListener('click',reset);
$('empty-reset').addEventListener('click',()=>{reset();$('search').focus();});
function locationControls(pending=false) {
  $('locate').hidden=Boolean(location);
  $('locate').disabled=pending;
  $('refresh-location').hidden=!location;
  $('refresh-location').disabled=pending;
  $('clear-location').hidden=!location && !pending;
}
function requestLocation() {
  const request=++locationRequest;
  locationControls(true);
  $('location-status').textContent='위치를 확인하는 중…';
  const fail=error=>{
    if(request!==locationRequest)return;
    location=null;
    $('my-location-link').hidden=true;$('my-location-link').removeAttribute('href');
    const message=({1:'위치 권한이 허용되지 않았습니다.',2:'현재 위치를 확인할 수 없습니다.',3:'위치 확인 시간이 초과되었습니다.',0:'이 브라우저는 위치 기능을 지원하지 않습니다.'})[error?.code] || '현재 위치를 확인할 수 없습니다.';
    $('location-status').textContent=`${message} 목록과 필터는 계속 사용할 수 있습니다. 브라우저 위치 권한을 확인하거나 Safari·Chrome 등 외부 브라우저에서 열어 다시 시도해 주세요.`;
    locationControls();render();
  };
  if(!navigator.geolocation){fail({code:0});return;}
  try { navigator.geolocation.getCurrentPosition(position=>{
    if(request!==locationRequest)return;
    location={lat:position.coords.latitude,lng:position.coords.longitude};
    $('location-status').textContent=`위도 ${location.lat.toFixed(6)} · 경도 ${location.lng.toFixed(6)} · 정확도 ±${Math.round(position.coords.accuracy)} m · 확인 ${new Date(position.timestamp).toLocaleString('ko-KR')}`;
    const link=$('my-location-link');
    link.href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.lat},${location.lng}`)}`;
    link.hidden=false;locationControls();render();
  },fail, {enableHighAccuracy:false,timeout:12000,maximumAge:0});
  } catch { fail({code:2}); }
}
$('locate').addEventListener('click',requestLocation);
$('refresh-location').addEventListener('click',requestLocation);
$('clear-location').addEventListener('click',()=>{
  ++locationRequest;location=null;
  $('my-location-link').hidden=true;$('my-location-link').removeAttribute('href');
  $('location-status').textContent='위치를 지웠습니다. 내 위치 버튼을 눌러 다시 확인할 수 있습니다.';
  $('sort').value='category';locationControls();render();$('locate').focus();
});
$('sort').addEventListener('change',render);
async function start() {
  try {
    const response=await fetch('./places.json');if(!response.ok)throw Error('Data unavailable');
    const data=await response.json();if(!Array.isArray(data.places))throw Error('Invalid data');
    places=data.places;$('source').textContent=data.sourceLabel || 'Google Maps 저장 목록';
    const areas=[...new Set(places.map(p=>p.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    for(const area of areas){const option=node('option',area);option.value=area;$('area').append(option);}
    $('data-status').hidden=true;render();
    void loadEnrichment();
  } catch {
    $('data-status').textContent='장소를 불러오지 못했습니다. 연결을 확인한 뒤 새로고침해 주세요.';
  }
}
start();
