// Physics and procedural rows adapted from Subway Rush (MIT), with fixed steps
// and an explicit empty lane so that every row always has a safe route.
export const CONFIG = Object.freeze({laneWidth:2.4,startSpeed:11,maxSpeed:25,acceleration:.11,gravity:29,jumpVelocity:11.5,rollDuration:.82,step:1/120});
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const damp=(k,dt)=>1-Math.exp(-k*dt);
export const laneX=l=>(l-1)*CONFIG.laneWidth;
export function planRow(distance,random=Math.random){
  const safe=Math.floor(random()*3), lanes=[0,1,2].filter(l=>l!==safe);
  if(random()<.5)lanes.reverse();
  const count=distance<150?1:(random()<.65?2:1);
  const obstacles=lanes.slice(0,count).map(lane=>{
    const r=random();return {lane,type:r<.42?'low':r<.76?'high':'cart'};
  });
  return {safe,obstacles};
}
export function verticalStep(y,velocity,grounded,dt){
  if(grounded)return {y:0,velocity:0,grounded:true};
  velocity-=CONFIG.gravity*dt;y+=velocity*dt;
  if(y<=0)return {y:0,velocity:0,grounded:true};
  return {y,velocity,grounded:false};
}
export function collision(o,player){
  const h=player.rolling?.92:2.36;
  return Math.abs(player.x-o.x)<o.halfWidth+.35 && player.y<o.top && player.y+h>o.bottom && Math.max(o.previousZ,o.z)+o.halfDepth>-.30 && Math.min(o.previousZ,o.z)-o.halfDepth<.30;
}
export function loadRecord(storage){
  try{const value=Number(storage.getItem('rilakkumaSweetRun.best'));return Number.isFinite(value)&&value>0?Math.floor(value):0;}catch{return 0;}
}
