import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG,planRow,collision,verticalStep,loadRecord,laneX,damp} from '../src/rules.mjs';
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('10,000 generated rows each preserve a usable empty lane, even at late distances',()=>{
  const rng=seeded(20261125);for(let i=0;i<10000;i++){const row=planRow(i*20,rng);assert(row.safe>=0&&row.safe<3);assert(!row.obstacles.some(o=>o.lane===row.safe));assert(row.obstacles.length<=2);assert.equal(new Set(row.obstacles.map(o=>o.lane)).size,row.obstacles.length);}
});
test('a maximum-speed swept obstacle cannot skip through the player',()=>{const o={x:0,bottom:0,top:1.06,halfWidth:.94,halfDepth:.4,previousZ:-2,z:2};assert(collision(o,{x:0,y:0,rolling:false}));assert(!collision(o,{x:0,y:1.1,rolling:false}));assert(!collision(o,{x:laneX(0),y:0,rolling:false}));});
test('rolling clears the flag beam; standing still collides',()=>{const o={x:0,bottom:1.66,top:2.64,halfWidth:.96,halfDepth:.4,previousZ:-.1,z:0};assert(collision(o,{x:0,y:0,rolling:false}));assert(!collision(o,{x:0,y:0,rolling:true}));});
test('jump reaches above picnic basket and returns to stable ground',()=>{let p={y:0,velocity:CONFIG.jumpVelocity,grounded:false},peak=0;for(let i=0;i<240;i++){p=verticalStep(p.y,p.velocity,p.grounded,CONFIG.step);peak=Math.max(peak,p.y);}assert(peak>2&&peak<2.5);assert.deepEqual(p,{y:0,velocity:0,grounded:true});});
test('two-lane travel fits comfortably inside minimum row reaction time',()=>{let x=laneX(0),t=0;while(Math.abs(x-laneX(2))>.1){x+=(laneX(2)-x)*damp(18,CONFIG.step);t+=CONFIG.step;}assert(t<.3);assert((26+CONFIG.maxSpeed*.25)/CONFIG.maxSpeed>1.2);});
test('corrupted or unavailable browser storage does not break the game',()=>{for(const input of ['NaN','Infinity','-10','bad',null])assert.equal(loadRecord({getItem:()=>input}),0);assert.equal(loadRecord({getItem(){throw Error('blocked');}}),0);assert.equal(loadRecord({getItem:()=>123.9}),123);});
