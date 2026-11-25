import * as THREE from 'three';
import {CONFIG,clamp,damp,laneX,planRow,verticalStep,collision,loadRecord} from './rules.mjs';
import {makeStage,makeBear,makeTile,pudding,makeLowBarrier,makeHighBarrier,makeTrain,makeParticles,makePuddingBatch} from './world.js';
import {SweetAudio} from './audio.js';

// Derived from Subway Rush by Mohamed Amine Dehane, MIT.
// Reuses its lane smoothing, jump/roll controls, obstacle rows, AABB collisions,
// recycled track and browser-local records. The visual world is newly authored.
const $=id=>document.getElementById(id);
const canvas=$('game');
let stage;
try{stage=makeStage(canvas);}catch(error){$('loading').innerHTML='<p>小镇暂时没能打开。请使用支持 WebGL 的浏览器重试。</p><button onclick="location.reload()">重新打开</button>';throw error;}
const {renderer,scene,camera,sun}=stage;
const audio=new SweetAudio();
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const runner=makeBear();scene.add(runner.root);
const particles=makeParticles(scene);
const puddingBatch=makePuddingBatch(scene);
const tiles=Array.from({length:5},()=>{const t=makeTile();scene.add(t);return t;});
const prototypes={low:makeLowBarrier(),high:makeHighBarrier(),cart:makeTrain(),pudding:pudding()};
const pools={low:[],high:[],cart:[],pudding:[]}, obstacles=[],coins=[];
const G={state:'menu',lane:1,px:0,py:0,vy:0,grounded:true,rollTimer:0,speed:CONFIG.startSpeed,distance:0,coins:0,best:loadRecord(localStorageSafe()),elapsed:0,spawnAt:65,phase:0,crashTime:0,shield:0,toastTime:0,lastMilestone:0};
function localStorageSafe(){try{return localStorage;}catch{return {getItem(){return null;}};}}
let accumulator=0,lastTime=0,visualTime=0,homeBlend=1,tutorialFade=false,metricTime=0,metricFrames=0;
function state(name){G.state=name;document.body.dataset.state=name;$('hud').hidden=name==='menu';$('over').hidden=name!=='over';$('pause').hidden=name!=='paused';$('tutorial').hidden=name!=='playing'||G.elapsed>9;}
function updateBest(){ $('home-best').innerHTML=`${G.best.toLocaleString()} <small>米</small>`;$('best-hud').textContent=G.best.toLocaleString(); }
function saveBest(){if(Math.floor(G.distance)>G.best){G.best=Math.floor(G.distance);try{localStorage.setItem('rilakkumaSweetRun.best',String(G.best));}catch{}updateBest();}}
function acquire(type){const item=pools[type].pop()||prototypes[type].clone();item.visible=true;item.rotation.set(0,0,0);item.scale.setScalar(1);if(type!=='pudding')scene.add(item);return item;}
function release(type,item){scene.remove(item);pools[type].push(item);}
function clearWorld(){for(const o of obstacles)release(o.type,o.mesh);for(const c of coins)release('pudding',c.mesh);obstacles.length=0;coins.length=0;}
function reset(){
  clearWorld();Object.assign(G,{lane:1,px:0,py:0,vy:0,grounded:true,rollTimer:0,speed:CONFIG.startSpeed,distance:0,coins:0,elapsed:0,spawnAt:65,phase:0,crashTime:0,toastTime:0,lastMilestone:0});
  tiles.forEach((tile,i)=>tile.position.z=18-i*40);runner.root.rotation.set(0,0,0);runner.body.scale.setScalar(1);runner.body.rotation.set(0,0,0);
  $('score-hud').textContent='0';$('coins-hud').textContent='0';$('toast').classList.remove('show');$('tutorial').style.opacity='1';tutorialFade=false;accumulator=0;
  // A generous opening section lets the player learn before any collision.
  for(let i=0;i<9;i++)addCoin(1,1.1,-9-i*3);
  spawnAhead();
}
function start(){audio.start();reset();state('playing');audio.effect('start');canvas.focus();}
function home(){saveBest();reset();state('menu');document.activeElement?.blur();}
function togglePause(){if(G.state==='playing'){state('paused');$('resume-btn').focus();}else if(G.state==='paused'){state('playing');lastTime=0;accumulator=0;canvas.focus();}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');G.toastTime=3;}
function finish(){const record=Math.floor(G.distance)>G.best;saveBest();state('over');$('final-score').textContent=Math.floor(G.distance).toLocaleString();$('final-coins').textContent=G.coins;$('final-best').textContent=G.best.toLocaleString();$('new-best').hidden=!record;$('again-btn').focus();}
function crash(){if(G.state!=='playing')return;state('crashed');G.crashTime=.75;audio.effect('crash');$('flash').style.opacity='.35';setTimeout(()=>$('flash').style.opacity='0',80);}
function move(dir){if(G.state!=='playing')return;G.lane=clamp(G.lane+dir,0,2);}
function jump(){if(G.state!=='playing'||!G.grounded)return;G.vy=CONFIG.jumpVelocity;G.grounded=false;G.rollTimer=0;audio.effect('jump');}
function roll(){if(G.state!=='playing')return;if(!G.grounded)G.vy=-23;G.rollTimer=CONFIG.rollDuration;audio.effect('roll');}
function addCoin(lane,y,z){const m=acquire('pudding');m.position.set(laneX(lane),y,z);coins.push({mesh:m,lane,baseY:y,phase:Math.random()*6,z,taken:false});}
function addObstacle(type,lane,z){
  const m=acquire(type),x=laneX(lane);m.position.set(x,0,z);const cart=type==='cart';
  obstacles.push({type,lane,x,z,previousZ:z,halfWidth:cart?1.02:type==='high'?.96:.94,halfDepth:cart?1.1:.40,bottom:type==='high'?1.66:0,top:type==='high'?2.64:cart?3.25:1.06,mesh:m});
  // Cart models are authored behind their origin; center the collision volume.
  if(cart)m.position.z=z+1.1;
}
function spawnAhead(){
  while(G.spawnAt<G.distance+145){
    const z=G.distance-G.spawnAt;
    const row=planRow(G.spawnAt);
    for(const {type,lane} of row.obstacles)addObstacle(type,lane,z);
    for(let i=0;i<6;i++)addCoin(row.safe,1.1,z+6-i*2.7);
    // Optional jump arcs reward an active route while the empty lane stays safe.
    if(G.spawnAt>140){const low=row.obstacles.find(o=>o.type==='low');if(low)for(let i=0;i<5;i++)addCoin(low.lane,1.15+1.6*(1-((i-2)/2.5)**2),z+3.6-i*1.8);}
    G.spawnAt+=26+Math.random()*10+G.speed*.25;
  }
}
function step(dt){
  G.elapsed+=dt;G.speed=Math.min(CONFIG.maxSpeed,G.speed+CONFIG.acceleration*dt);const advance=G.speed*dt;G.distance+=advance;
  G.px+=(laneX(G.lane)-G.px)*damp(18,dt);G.rollTimer=Math.max(0,G.rollTimer-dt);
  const vertical=verticalStep(G.py,G.vy,G.grounded,dt);G.py=vertical.y;G.vy=vertical.velocity;G.grounded=vertical.grounded;
  for(const tile of tiles){tile.position.z+=advance;if(tile.position.z>58)tile.position.z-=tiles.length*40;}
  for(const o of obstacles){o.previousZ=o.z;o.z+=advance;o.mesh.position.z=o.z+(o.type==='cart'?1.1:0);if(collision(o,{x:G.px,y:G.py,rolling:G.rollTimer>0})){crash();return;}}
  const h=G.rollTimer>0?.92:2.36;
  for(const c of coins){if(c.taken)continue;c.z+=advance;c.mesh.position.z=c.z;
    if(Math.abs(c.mesh.position.x-G.px)<.78&&Math.abs(c.z)<.70&&Math.abs(c.baseY-(G.py+h*.5))<1.05){
      c.taken=true;c.mesh.visible=false;G.coins++;audio.effect('coin');particles.burst(c.mesh.position.x,c.mesh.position.y,c.z);
      if(G.coins%10===0)toast(`又收集了 10 个布丁，甜甜的！`);
    }
  }
  for(let i=obstacles.length-1;i>=0;i--)if(obstacles[i].z>15){release(obstacles[i].type,obstacles[i].mesh);obstacles.splice(i,1);}
  for(let i=coins.length-1;i>=0;i--)if(coins[i].z>12||coins[i].taken){release('pudding',coins[i].mesh);coins.splice(i,1);}
  spawnAhead();
  const milestone=Math.floor(G.distance/500);if(milestone>G.lastMilestone){G.lastMilestone=milestone;toast(`${milestone*500} 米 · 小镇的风也在为你加油`);}
  if(G.elapsed>7&&!tutorialFade){tutorialFade=true;$('tutorial').style.opacity='0';}
  if(G.elapsed>9)$('tutorial').hidden=true;
}
function animate(dt,t){
  const menu=G.state==='menu',paused=G.state==='paused',ended=G.state==='crashed'||G.state==='over';
  homeBlend+=((menu?1:0)-homeBlend)*damp(5,dt);
  const portrait=camera.aspect<.8,heroX=portrait?0:3.15;
  runner.root.position.set(G.px*(1-homeBlend)+heroX*homeBlend,G.py*(1-homeBlend),homeBlend*(portrait?2.0:1.6));
  const sc=1+homeBlend*(portrait?.02:.55);runner.root.scale.setScalar(sc);
  const targetRotation=menu?-.17:Math.PI;
  let delta=targetRotation-runner.root.rotation.y;while(delta>Math.PI)delta-=Math.PI*2;while(delta<-Math.PI)delta+=Math.PI*2;
  runner.root.rotation.y+=delta*damp(7,dt);
  if(!paused){
    G.phase+=dt*(menu?(reduced?0:2.6):G.state==='playing'?G.speed*1.45:0);
    const s=Math.sin(G.phase),rolling=G.rollTimer>0;
    const head=runner.head,body=runner.body;
    const targetY=rolling?.43:1;
    body.scale.y+=(targetY-body.scale.y)*damp(19,dt);
    body.rotation.x+=((ended?-1.08:rolling?-.3:0)-body.rotation.x)*damp(7,dt);
    body.rotation.z+=((ended?.30:clamp((G.px-laneX(G.lane))*.10,-.23,.23))*(1-homeBlend)-body.rotation.z)*damp(10,dt);
    const amp=menu?.08:ended?0:rolling?.1:G.grounded?.56:.1;
    runner.legL.rotation.x=s*amp;runner.legR.rotation.x=-s*amp;
    runner.armL.rotation.x=menu?-.1:-s*amp*.85;runner.armR.rotation.x=menu?Math.sin(t*2)*.12:-runner.armL.rotation.x;
    runner.armL.rotation.z=menu?.15:rolling?.7:.08;runner.armR.rotation.z=menu?-.21:rolling?-.7:-.08;
    body.position.y=ended?-.10:rolling?.12:Math.abs(s)*(menu?.035:.09);
    head.rotation.z=menu&&!reduced?Math.sin(t*.8)*.035:0;
  }
  const targetX=G.px*.20*(1-homeBlend),targetY=5.6+homeBlend*(portrait?2.2:.2);
  camera.position.x+=(targetX-camera.position.x)*damp(6,dt);camera.position.y+=(targetY-camera.position.y)*damp(6,dt);camera.position.z=10.8+homeBlend*(portrait?4.2:1.3);
  camera.lookAt(0,1.3+homeBlend*(portrait?1.8:.2),-8);
  const fov=portrait?63:52+(G.speed-CONFIG.startSpeed)*.10;camera.fov=fov;camera.updateProjectionMatrix();
  sun.position.set(-9,22,12);sun.target.position.set(0,0,-10);
  for(const c of coins){c.mesh.position.y=c.baseY+(reduced?0:Math.sin(t*3+c.phase)*.09);c.mesh.rotation.y=t*.6;}
  puddingBatch.update(coins);
  for(const tile of tiles)tile.visible=tile.position.z>-110&&tile.position.z<50;
  stage.tick(t,0,reduced);
}
function frame(now){
  const dt=lastTime?Math.min((now-lastTime)/1000,.1):1/60;lastTime=now;
  if(G.state!=='paused')visualTime+=dt;
  if(G.state==='playing'){
    accumulator+=dt;while(accumulator>=CONFIG.step&&G.state==='playing'){step(CONFIG.step);accumulator-=CONFIG.step;}
  }else accumulator=0;
  if(G.state==='crashed'){G.crashTime-=dt;if(G.crashTime<=0)finish();}
  if(G.toastTime>0&&G.state!=='paused'){G.toastTime-=dt;if(G.toastTime<=0)$('toast').classList.remove('show');}
  const animDt=G.state==='paused'?0:dt;particles.update(animDt);animate(dt,visualTime);audio.update(G.state==='playing');
  $('score-hud').textContent=Math.floor(G.distance);$('coins-hud').textContent=G.coins;
  renderer.render(scene,camera);
  metricTime+=dt;metricFrames++;
  if(metricTime>=.5){canvas.dataset.telemetry=JSON.stringify({state:G.state,lane:G.lane,y:+G.py.toFixed(2),rolling:G.rollTimer>0,distance:Math.floor(G.distance),coins:G.coins,best:G.best,fps:Math.round(metricFrames/metricTime),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,objects:scene.children.length,obstacles:obstacles.map(o=>({type:o.type,lane:o.lane,z:+o.z.toFixed(1)})).filter(o=>o.z<3&&o.z>-45)});metricTime=0;metricFrames=0;}
  requestAnimationFrame(frame);
}
function updateSound(){const b=$('sound-btn');b.classList.toggle('muted',audio.muted);b.setAttribute('aria-label',audio.muted?'打开声音':'关闭声音');b.setAttribute('aria-pressed',String(!audio.muted));}
$('play-btn').addEventListener('click',start);$('again-btn').addEventListener('click',start);$('home-btn').addEventListener('click',home);$('pause-home-btn').addEventListener('click',home);$('resume-btn').addEventListener('click',togglePause);$('pause-btn').addEventListener('click',togglePause);
$('sound-btn').addEventListener('click',()=>{audio.toggle();updateSound();});
for(const [button,dialog] of [['help-btn','help-dialog'],['credits-btn','credits-dialog']])$(button).addEventListener('click',()=>$(dialog).showModal());
for(const b of document.querySelectorAll('.close-dialog'))b.addEventListener('click',()=>b.closest('dialog').close());
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
window.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]'))return;
  const k=e.code;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(k))e.preventDefault();
  if((k==='KeyP'||k==='Escape')&&!e.repeat){togglePause();return;}
  if((G.state==='menu'||G.state==='over')&&(k==='Space'||k==='Enter')&&!e.repeat){start();return;}
  if(G.state==='paused'&&k==='Space'&&!e.repeat){togglePause();return;}
  if(k==='ArrowLeft'||k==='KeyA')move(-1);else if(k==='ArrowRight'||k==='KeyD')move(1);else if((k==='ArrowUp'||k==='KeyW'||k==='Space')&&!e.repeat)jump();else if(k==='ArrowDown'||k==='KeyS')roll();
});
let gesture=null;
canvas.addEventListener('pointerdown',e=>{if(G.state==='playing')gesture={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointermove',e=>{if(!gesture||G.state!=='playing')return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;gesture=null;if(Math.abs(dx)>Math.abs(dy))move(Math.sign(dx));else if(dy<0)jump();else roll();});
window.addEventListener('pointerup',()=>gesture=null);window.addEventListener('pointercancel',()=>gesture=null);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.state==='playing')togglePause();});
window.addEventListener('pagehide',saveBest);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(G.state==='playing')togglePause();toast('画面暂时休息了，请刷新后再试');});
canvas.tabIndex=-1;
reset();state('menu');updateBest();updateSound();$('loading').remove();requestAnimationFrame(frame);
// Read-only QA telemetry; no production cheat controls.
Object.defineProperty(window,'sweetRun',{get:()=>Object.freeze({state:G.state,lane:G.lane,x:G.px,y:G.py,rolling:G.rollTimer>0,distance:G.distance,coins:G.coins,best:G.best,speed:G.speed,activeObstacles:obstacles.length,activeCoins:coins.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,objects:scene.children.length,pooled:Object.fromEntries(Object.entries(pools).map(([k,v])=>[k,v.length]))})});
