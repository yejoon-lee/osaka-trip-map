import {CATEGORIES, filterPlaces, categoryCounts, placeLinks} from './core.mjs';
const $ = id => document.getElementById(id);
let places = [];
const filters = {query:'',category:'',area:''};
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function render() {
  const visible = filterPlaces(places,filters);
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
  for (const category of CATEGORIES) {
    const members=visible.filter(p=>p.category===category);
    if (!members.length) continue;
    const group=node('section',undefined,'category-group');
    const heading=node('h2',`${category} ${members.length}`);
    heading.id=`category-${CATEGORIES.indexOf(category)}`;
    group.setAttribute('aria-labelledby',heading.id);group.append(heading);
    for (const p of members) {
      const card=node('article',undefined,'place-card');card.dataset.id=p.id;
      card.append(node('h3',p.name,'place-title'),node('p',[p.area,p.kind].filter(Boolean).join(' · '),'metadata'));
      if(p.originalName && p.originalName!==p.name)card.append(node('p',p.originalName,'place-original'));
      if(p.note)card.append(node('p',p.note,'note'));
      if(p.address)card.append(node('p',p.address,'address'));
      const link=node('a','Google Maps에서 보기 ↗','place-link');
      link.href=placeLinks(p).place;link.target='_blank';link.rel='noopener noreferrer';
      link.setAttribute('aria-label',`${p.name} Google Maps에서 보기 (새 탭)`);
      card.append(link);group.append(card);
    }
    $('list').append(group);
  }
}
function reset() {
  Object.assign(filters,{query:'',category:'',area:''});
  $('search').value='';$('area').value='';render();
}
$('search').addEventListener('input',e=>{filters.query=e.target.value;render();});
$('area').addEventListener('change',e=>{filters.area=e.target.value;render();});
$('reset').addEventListener('click',reset);
$('empty-reset').addEventListener('click',()=>{reset();$('search').focus();});
async function start() {
  try {
    const response=await fetch('./places.json');if(!response.ok)throw Error('Data unavailable');
    const data=await response.json();if(!Array.isArray(data.places))throw Error('Invalid data');
    places=data.places;$('source').textContent=data.sourceLabel || 'Google Maps 저장 목록';
    const areas=[...new Set(places.map(p=>p.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    for(const area of areas){const option=node('option',area);option.value=area;$('area').append(option);}
    $('data-status').hidden=true;render();
  } catch {
    $('data-status').textContent='장소를 불러오지 못했습니다. 연결을 확인한 뒤 새로고침해 주세요.';
  }
}
start();
