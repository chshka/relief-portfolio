import './loading-screen.js';
import './relief-background.js';
import {linkReliefText} from './relief-text.js';
document.documentElement.classList.add('js');
const reveal=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');reveal.unobserve(e.target)}}),{threshold:.08});
document.querySelectorAll('.reveal').forEach(e=>reveal.observe(e));
const links=[...document.querySelectorAll('.rail a')];
const sections=[...document.querySelectorAll('main section,main footer')];
const desktop=matchMedia('(min-width:1024px)');
let wheelTarget=scrollX,wheelFrame=0;
addEventListener('wheel',e=>{
 if(!desktop.matches||e.ctrlKey||document.documentElement.classList.contains('loading'))return;
 const box=e.target.closest?.('.hero,.section');if(box&&box.scrollHeight>box.clientHeight+1&&((e.deltaY>0&&box.scrollTop+box.clientHeight<box.scrollHeight-1)||(e.deltaY<0&&box.scrollTop>0)))return;
 e.preventDefault();const delta=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?innerWidth:1);
 if(!wheelFrame)wheelTarget=scrollX;
 wheelTarget=Math.max(0,Math.min(document.documentElement.scrollWidth-innerWidth,wheelTarget+delta));
 if(wheelFrame)return;let previous=performance.now();
 const tick=t=>{const k=matchMedia('(prefers-reduced-motion:reduce)').matches?1:1-Math.exp(-(t-previous)/75);previous=t;const x=scrollX+(wheelTarget-scrollX)*k;scrollTo(x,0);if(Math.abs(wheelTarget-scrollX)>1)wheelFrame=requestAnimationFrame(tick);else{scrollTo(wheelTarget,0);wheelFrame=0}};wheelFrame=requestAnimationFrame(tick);
},{passive:false});
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;const target=document.querySelector(a.hash);if(!target)return;e.preventDefault();cancelAnimationFrame(wheelFrame);wheelFrame=0;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start',inline:'start'});history.replaceState(null,'',a.hash)});
function update(){const horizontal=desktop.matches,extent=horizontal?document.documentElement.scrollWidth-innerWidth:document.documentElement.scrollHeight-innerHeight;document.documentElement.style.setProperty('--progress',extent>0?(horizontal?scrollX:scrollY)/extent:0);let active=sections[0];for(const section of sections)if((horizontal?section.getBoundingClientRect().left:section.getBoundingClientRect().top)<(horizontal?innerWidth:innerHeight)*.5)active=section;links.forEach(a=>{const selected=a.hash==='#'+active.id;a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});document.querySelector('.hero-foot a').textContent=horizontal?'向右探索 →':'向下探索 ↓'}
addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();
const background=document.querySelector('relief-background'),toggle=document.querySelector('#motion');
linkReliefText(background);
let enabled=!matchMedia('(prefers-reduced-motion: reduce)').matches;
function sync(){background.toggleAttribute('paused',!enabled);toggle.setAttribute('aria-pressed',String(enabled));toggle.querySelector('span').textContent=enabled?'开':'关'}
toggle.addEventListener('click',()=>{enabled=!enabled;sync()});sync();
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{enabled=!e.matches;sync()});
