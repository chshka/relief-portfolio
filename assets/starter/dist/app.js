import './loading-screen.js';
import './relief-background.js';
import {linkReliefText} from './relief-text.js';
document.documentElement.classList.add('js');
const reveal=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');reveal.unobserve(e.target)}}),{threshold:.08});
document.querySelectorAll('.reveal').forEach(e=>reveal.observe(e));
const links=[...document.querySelectorAll('.rail a')];
const sections=[...document.querySelectorAll('main section,main footer')];
function update(){const extent=document.documentElement.scrollHeight-innerHeight;document.documentElement.style.setProperty('--progress',extent>0?scrollY/extent:0);let active=sections[0];for(const section of sections)if(section.getBoundingClientRect().top<innerHeight*.5)active=section;links.forEach(a=>{const selected=a.hash==='#'+active.id;a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})}
addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();
const background=document.querySelector('relief-background'),toggle=document.querySelector('#motion');
linkReliefText(background);
let enabled=!matchMedia('(prefers-reduced-motion: reduce)').matches;
function sync(){background.toggleAttribute('paused',!enabled);toggle.setAttribute('aria-pressed',String(enabled));toggle.querySelector('span').textContent=enabled?'开':'关'}
toggle.addEventListener('click',()=>{enabled=!enabled;sync()});sync();
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{enabled=!e.matches;sync()});
