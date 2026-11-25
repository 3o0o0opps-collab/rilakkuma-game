import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All meshes are authored here; character proportions follow the San-X Rilakkuma reference.
const geo = new THREE.SphereGeometry(1, 24, 16);
const lowSphere = new THREE.SphereGeometry(1, 12, 8);
const roundGeo = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
const v = new THREE.Vector3(), c = new THREE.Vector3();
for (let i = 0; i < roundGeo.attributes.position.count; i++) {
  v.fromBufferAttribute(roundGeo.attributes.position, i);
  c.set(THREE.MathUtils.clamp(v.x, -.38, .38), THREE.MathUtils.clamp(v.y, -.38, .38), THREE.MathUtils.clamp(v.z, -.38, .38));
  v.sub(c).normalize().multiplyScalar(.12).add(c);
  roundGeo.attributes.position.setXYZ(i, v.x, v.y, v.z);
}
roundGeo.computeVertexNormals();
const matCache = new Map();
export function material(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({color, roughness:.83, ...extra}));
  return matCache.get(key);
}
export const M = {
  brown:material('#986624'), dark:material('#513724'), cream:material('#fff5d8'), inner:material('#f2d166'),
  pink:material('#eeb1b2'), palePink:material('#efb9bc'), mint:material('#b3d0b6'), sage:material('#89ae8c'),
  wood:material('#b98f60'), yellow:material('#edc06c'), red:material('#cf7f76'), white:material('#fff9ed'),
  glass:material('#a4c9c0',{roughness:.3,metalness:.1}), leaf:material('#8eb396'), cocoa:material('#9c6941')
};
function mesh(g, m, x,y,z,sx,sy,sz, parent, shadow=true) {
  const a=new THREE.Mesh(g,m); a.position.set(x,y,z); a.scale.set(sx,sy,sz); a.castShadow=shadow; a.receiveShadow=true; parent.add(a);return a;
}
export function ball(parent,m,x,y,z,sx,sy=sx,sz=sx){return mesh(sx<=.35&&sy<=.6&&sz<=.35?lowSphere:geo,m,x,y,z,sx,sy,sz,parent);}
export function box(parent,m,x,y,z,sx,sy,sz){return mesh(roundGeo,m,x,y,z,sx,sy,sz,parent);}
function cylinder(parent,m,x,y,z,rt,rb,h,segments=20){const a=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a;}
const labelCache=new Map();
function label(text, bg='#fff5dc', ink='#856443', w=512,h=160){
  const key=text+bg+ink;
  if(labelCache.has(key))return labelCache.get(key);
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const q=cv.getContext('2d');
  q.fillStyle=bg;q.fillRect(0,0,w,h);q.strokeStyle=ink;q.globalAlpha=.2;q.lineWidth=4;q.strokeRect(13,13,w-26,h-26);q.globalAlpha=1;
  q.fillStyle=ink;q.textAlign='center';q.textBaseline='middle';q.font=`600 ${text.length>14?36:44}px Georgia, 'PingFang SC', sans-serif`;q.fillText(text,w/2,h/2+2,w-52);
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.MeshBasicMaterial({map:t});labelCache.set(key,m);return m;
}
function sign(parent,text,x,y,z,w=3.6,h=.85,bg,ink){
  box(parent,M.wood,x,y,z-.025,w+.13,h+.13,.14);
  const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),label(text,bg,ink));p.position.set(x,y,z+.06);parent.add(p);return p;
}
export function makeBear(){
  const root=new THREE.Group(), body=new THREE.Group();root.add(body);
  ball(body,M.brown,0,1.05,0,.59,.78,.42);
  ball(body,M.cream,0,1.02,.383,.35,.46,.055);
  const head=new THREE.Group();head.position.y=1.93;body.add(head);
  ball(head,M.brown,0,0,.015,.91,.72,.50);
  for(const s of [-1,1]){
    ball(head,M.brown,s*.69,.54,.012,.31,.31,.20);
    ball(head,M.inner,s*.69,.54,.177,.205,.208,.055);
    ball(head,M.dark,s*.31,-.045,.481,.061,.066,.031);
  }
  ball(head,M.cream,0,-.255,.486,.267,.19,.069);
  ball(head,M.dark,0,-.19,.552,.079,.051,.029);
  const line=(pts)=>{const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));const a=new THREE.Mesh(new THREE.TubeGeometry(curve,10,.014,7,false),M.dark);head.add(a);};
  line([[0,-.23,.555],[0,-.27,.562],[-.07,-.31,.55],[-.11,-.292,.536]]);
  line([[0,-.27,.562],[.07,-.31,.55],[.11,-.292,.536]]);
  const limb=(x,y,z,w,h,d)=>{const pivot=new THREE.Group();pivot.position.set(x,y,z);ball(pivot,M.brown,0,-h*.3,0,w,h,d);body.add(pivot);return pivot;};
  const armL=limb(-.58,1.3,0,.22,.44,.23),armR=limb(.58,1.3,0,.22,.44,.23);
  const legL=limb(-.30,.53,.015,.25,.36,.29),legR=limb(.30,.53,.015,.25,.36,.29);
  for(const [leg,s] of [[legL,-1],[legR,1]]){ball(leg,M.brown,0,-.25,.11,.255,.18,.34);ball(leg,M.inner,0,-.31,.26,.14,.052,.095);}
  // The tiny tail and zip distinguish the costume bear when seen from behind.
  ball(body,M.brown,0,.62,-.42,.19,.18,.15);
  box(body,M.cocoa,0,1.26,-.418,.035,.70,.025);
  for(let i=0;i<11;i++)box(body,M.yellow,(i%2?1:-1)*.015,1.53-i*.053,-.44,.031,.012,.014);
  const zip=new THREE.Mesh(new THREE.TorusGeometry(.04,.012,6,12),M.cocoa);zip.position.set(0,1.64,-.45);body.add(zip);
  return {root,body,head,armL,armR,legL,legR};
}
export function makePudding(){
  const g=new THREE.Group();cylinder(g,M.cream,0,-.18,0,.40,.40,.06);
  cylinder(g,M.yellow,0,.03,0,.26,.34,.38);
  cylinder(g,M.cocoa,0,.245,0,.272,.26,.065);
  ball(g,M.cream,0,.3,0,.10,.075,.10);
  ball(g,M.red,.035,.37,0,.055);
  return g;
}
const puddingPrototype=makePudding();
export function pudding(){return puddingPrototype.clone();}
export function makeLowBarrier(){
  const g=new THREE.Group();box(g,M.wood,0,.44,0,1.85,.86,.90);
  for(let i=0;i<4;i++)box(g,M.yellow,0,.18+i*.18,.461,1.76,.045,.03);
  for(const x of [-.57,.57])box(g,M.cocoa,x,.46,.478,.055,.78,.035);
  const h=new THREE.Mesh(new THREE.TorusGeometry(.32,.065,8,20,Math.PI),M.cocoa);h.position.set(0,.86,0);g.add(h);
  box(g,M.palePink,0,.88,0,1.96,.14,1.02);
  for(let i=0;i<5;i++)box(g,M.white,-.77+i*.38,.96,0,.15,.014,.92);
  return g;
}
export function makeHighBarrier(){
  const g=new THREE.Group();
  for(const s of [-1,1]){cylinder(g,M.wood,s*1.08,1.5,0,.072,.085,3);ball(g,M.yellow,s*1.08,3.04,0,.115);}
  box(g,M.wood,0,2.6,0,2.27,.075,.075);
  const flag=new THREE.Shape();flag.moveTo(-.21,0);flag.lineTo(.21,0);flag.lineTo(0,-.55);flag.closePath();
  const fgeo=new THREE.ShapeGeometry(flag);
  for(let i=0;i<5;i++){const a=new THREE.Mesh(fgeo,[M.pink,M.mint,M.yellow][i%3]);a.material=a.material.clone();a.material.side=THREE.DoubleSide;a.position.set(-.84+i*.42,2.56,.015);g.add(a);}
  box(g,M.pink,0,1.99,0,1.86,.45,.16);sign(g,'SWEET DAY',0,2.0,.10,1.6,.31,'#f5c9bb','#8d6445');
  return g;
}
export function makeTrain(){
  const g=new THREE.Group();
  box(g,M.mint,0,1.0,-1.1,2.05,1.5,2.2);box(g,M.cream,0,1.82,-1.1,2.17,.2,2.35);
  for(const x of [-.86,.86])for(const z of [-.2,-1.95]){const w=cylinder(g,M.cocoa,x,.33,z,.27,.27,.13,14);w.rotation.z=Math.PI/2;}
  for(const s of [-1,1])for(const z of [-.15,-2.05])cylinder(g,M.wood,s*.9,2.43,z,.035,.035,1.2);
  box(g,M.pink,0,3.0,-1.1,2.35,.22,2.6);
  for(let i=0;i<7;i++)box(g,M.cream,-.97+i*.32,3.13,-1.1,.15,.035,2.6);
  sign(g,'布丁小铺',0,1.15,.035,1.6,.60,'#fff3d6','#876545');
  const p=makePudding();p.position.set(0,2.08,-.65);p.scale.setScalar(1.4);g.add(p);
  for(const x of [-.65,.65])ball(g,M.palePink,x,2.02,-1.5,.23,.23,.23);
  return g;
}
function tree(parent,x,z,pink=true,scale=1){
  const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
  cylinder(g,M.wood,0,1.35,0,.13,.23,2.7,8);
  const m=pink?M.palePink:M.leaf;
  for(const [cx,cy,cz,r] of [[0,3.3,0,1.05],[-.65,2.9,0,.8],[.65,3.05,.12,.8],[0,3.0,.6,.72],[.1,3.1,-.65,.74]])mesh(lowSphere,m,cx,cy,cz,r,r*.92,r,g);
  if(pink)for(const s of [-1,1])ball(g,M.pink,s*.6,3.55,.2,.38,.29,.38);
  box(g,M.cream,0,.17,0,1.3,.34,1.3);box(g,M.sage,0,.33,0,1.12,.09,1.12);
}
function flowers(parent,x,y,z){
  box(parent,M.wood,x,y,z,1.55,.28,.42);
  for(let i=0;i<5;i++){ball(parent,M.leaf,x-.57+i*.28,y+.22,z,.15,.18,.11);ball(parent,i%2?M.yellow:M.pink,x-.57+i*.28,y+.38,z+.01,.12,.12,.09);}
}
const shopPalette=[['#f2d9c8','#d9a5a3','PUDDING & CO.'],['#e7e3c5','#a9c6ae','little bakery'],['#f3d9b9','#cf9d83','HONEY CAFÉ'],['#e2d6d2','#b4afc5','la petite fleur'],['#e9dfbf','#dcb77e','まいにち おやつ']];
function shop(parent,x,z,index,side){
  const g=new THREE.Group();parent.add(g);g.position.set(x,0,z);g.rotation.y=-side*(Math.PI/2-.12);
  const [wall,trim,name]=shopPalette[index%shopPalette.length],wm=material(wall),tm=material(trim);
  const height=4.9+(index%3)*.5;
  box(g,wm,0,height/2,0,5.3,height,4.4);box(g,M.cream,0,.23,2.25,5.5,.46,.35);
  // Sloping roof with soft edge and a chimney.
  const roof=new THREE.Mesh(new THREE.ConeGeometry(4.2,1.5,4),tm);roof.rotation.y=Math.PI/4;roof.scale.z=.85;roof.position.y=height+.5;roof.castShadow=true;g.add(roof);
  box(g,tm,1.6,height+.7,-.8,.65,1.7,.65);box(g,M.cream,1.6,height+1.56,-.8,.77,.14,.77);
  box(g,M.wood,0,1.65,2.23,1.02,2.55,.16);box(g,M.glass,0,1.8,2.34,.70,1.95,.05);ball(g,M.yellow,.28,1.52,2.40,.05);
  for(const s of [-1,1]){
    box(g,M.cream,s*1.63,1.7,2.24,1.47,1.85,.20);box(g,M.glass,s*1.63,1.7,2.38,1.23,1.59,.025);
    box(g,M.cream,s*1.63,1.7,2.41,.045,1.6,.04);box(g,M.cream,s*1.63,1.7,2.41,1.23,.045,.04);
    flowers(g,s*1.63,.78,2.50);
    box(g,M.cream,s*1.3,4.05,2.26,.88,1.04,.15);box(g,M.glass,s*1.3,4.05,2.37,.68,.85,.025);box(g,M.cream,s*1.3,4.05,2.40,.035,.87,.02);
  }
  sign(g,name,0,3.28,2.32,4.38,.66);
  const aw=new THREE.Group();aw.position.set(0,2.85,2.60);aw.rotation.x=.20;g.add(aw);
  for(let i=0;i<12;i++){box(aw,i%2?M.cream:tm,-2.3+i*.419,0,.25,.42,.095,1.26);ball(aw,i%2?M.cream:tm,-2.3+i*.419,-.1,.89,.208,.15,.055);}
  if(index%2===0){const board=new THREE.Group();g.add(board);board.position.set(2.8,.65,3.3);board.rotation.y=-.15;box(board,M.wood,0,0,0,.76,1.1,.12);sign(board,'OPEN',0,.1,.1,.57,.65,'#4e6e58','#fff2cc');}
}
function lamp(parent,x,z){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  cylinder(g,M.cocoa,0,1.65,0,.055,.085,3.3,8);cylinder(g,M.cocoa,0,.12,0,.17,.20,.24,10);
  box(g,M.cocoa,.23,3.31,0,.55,.09,.09);ball(g,material('#ffedc0',{emissive:'#edcf8e',emissiveIntensity:.25}),.45,3.1,0,.19,.24,.19);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.30,.20,12),M.cocoa);cap.position.set(.45,3.38,0);g.add(cap);
}
function bench(parent,x,z,side){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=-side*Math.PI/2;parent.add(g);
  for(let i=0;i<3;i++)box(g,M.wood,0,.58,-.24+i*.22,1.8,.12,.16);
  for(let i=0;i<3;i++)box(g,M.wood,0,.85+i*.18,-.44,1.8,.12,.09);
  for(const x of [-.65,.65])box(g,M.cocoa,x,.3,0,.10,.6,.65);
}
function batchStatic(root){
  root.updateMatrixWorld(true);
  const groups=new Map();
  root.traverse(obj=>{if(!obj.isMesh)return;const key=obj.material.uuid;
    if(!groups.has(key))groups.set(key,{material:obj.material,geometries:[]});
    groups.get(key).geometries.push(obj.geometry.clone().applyMatrix4(obj.matrixWorld));});
  root.clear();
  for(const {material,geometries} of groups.values()){
    const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    const m=new THREE.Mesh(merged,material);m.castShadow=true;m.receiveShadow=true;root.add(m);
  }
}
let tileIndex=0;
export function makeTile(){
  const g=new THREE.Group(),idx=tileIndex++;
  mesh(new THREE.PlaneGeometry(90,40).rotateX(-Math.PI/2),material('#c9d8af'),0,-.08,0,1,1,1,g,false);
  const road=mesh(new THREE.PlaneGeometry(8.6,40).rotateX(-Math.PI/2),material('#ebd7bd'),0,.005,0,1,1,1,g,false);
  // Paired colored paving and dashed lane guides give a readable three-lane track.
  for(const s of [-1,1]){
    box(g,M.palePink,s*4.8,.10,0,1.0,.24,40);
    box(g,M.cream,s*4.29,.10,0,.10,.20,40);
    for(let i=0;i<10;i++)box(g,material('#ead2c2'),s*4.8,.229,-18+i*4,.95,.016,.035);
    for(let k=0;k<3;k++)shop(g,s*(8.6+(k%2)*.3),-15+k*14,(idx+k+(s>0?2:0))%5,s);
    tree(g,s*5.5,-7,idx%3!==2,.91);tree(g,s*5.5,13,idx%3!==1,.82);
    lamp(g,s*4.95,-17);lamp(g,s*4.95,4);bench(g,s*5.6,0,s);
    for(let i=0;i<3;i++)ball(g,M.leaf,s*(13.5+i),.3,9,.9,.6,.8);
  }
  for(const x of [-1.2,1.2])for(let i=0;i<10;i++)box(g,material('#f7e9d4'),x,.018,-18+i*4,.045,.018,1.25);
  // Small inlaid flowers, outside the obstacle lanes.
  for(const s of [-1,1])for(let i=0;i<4;i++){
    const z=-16+i*9;const flower=new THREE.Mesh(new THREE.CircleGeometry(.14,5),M.cream);flower.rotation.x=-Math.PI/2;flower.position.set(s*3.9,.023,z);g.add(flower);
  }
  batchStatic(g);
  return g;
}
export function randomizeBuildings(){/* Theme continuity: recycled chunks preserve their authored shop layout. */}
export function makeStage(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#dae8d9');scene.fog=new THREE.Fog('#dae8d9',45,135);
  const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,220);camera.position.set(0,5.8,11);
  scene.add(new THREE.HemisphereLight('#fff7e0','#b4bc96',1.7));
  const sun=new THREE.DirectionalLight('#ffedcc',2.0);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-20;sun.shadow.camera.right=20;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-20;sun.shadow.camera.near=1;sun.shadow.camera.far=65;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight('#ebf4f3',.7);fill.position.set(-12,10,8);scene.add(fill);
  const sky=new THREE.Group();scene.add(sky);
  for(let i=0;i<12;i++){
    const cloud=new THREE.Group();for(let j=0;j<4;j++)mesh(lowSphere,material('#fff9e9'),j*2.2,Math.sin(j*2)*.5,0,2.8,1.1,1.4,cloud,false);
    cloud.position.set(-55+i*10,19+(i%3)*3,-60-(i%4)*18);sky.add(cloud);
  }
  const hills=new THREE.Group();sky.add(hills);
  for(let i=0;i<13;i++)mesh(lowSphere,material(i%2?'#bdcfae':'#c5d3b5'),-90+i*15,0,-115,18,10+(i%4)*3,15,hills,false);
  const sunDisc=new THREE.Mesh(new THREE.CircleGeometry(5,48),new THREE.MeshBasicMaterial({color:'#fff0bc',fog:false}));sunDisc.position.set(22,20,-125);sky.add(sunDisc);
  // Petals are instanced and recycled, so a long run does not accumulate objects.
  const petals=new THREE.InstancedMesh(new THREE.SphereGeometry(1,5,3),M.palePink,50);petals.frustumCulled=false;scene.add(petals);
  const dummy=new THREE.Object3D();
  function tick(t,pz,reduced){
    sky.position.z=pz;
    for(let i=0;i<50;i++){
      const a=i*2.399;dummy.position.set(Math.sin(a)*13+Math.sin(t*.3+i)*1.2,((i*.71-t*(reduced?0:.29))%8+8)%8+.4,pz-((i*3.71+t*(reduced?0:1.9))%62)+8);
      dummy.rotation.set(t*.6+i,i,t*.4);dummy.scale.set(.055,.012,.10);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);
    }petals.instanceMatrix.needsUpdate=true;
  }
  return {renderer,scene,camera,sun,tick};
}
export function makeParticles(scene){
  const mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),material('#f8d689',{emissive:'#e7b862',emissiveIntensity:.2}),64);mesh.frustumCulled=false;scene.add(mesh);
  const list=Array.from({length:64},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0}));const obj=new THREE.Object3D();let cursor=0;
  return {burst(x,y,z){for(let i=0;i<8;i++){const p=list[cursor++%64],a=i*Math.PI/4;Object.assign(p,{life:.5,x,y,z,vx:Math.cos(a)*1.6,vy:1.5+Math.random(),vz:Math.sin(a)*1.6});}},update(dt){for(let i=0;i<64;i++){const p=list[i];p.life=Math.max(0,p.life-dt);p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=4*dt;obj.position.set(p.x,p.y,p.z);obj.scale.setScalar(p.life*.15);obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);}mesh.instanceMatrix.needsUpdate=true;}};
}

// One draw per pudding component instead of five draws for every collectible.
export function makePuddingBatch(scene){
  puddingPrototype.updateMatrixWorld(true);
  const batches=[];
  puddingPrototype.traverse(part=>{if(!part.isMesh)return;const inst=new THREE.InstancedMesh(part.geometry,part.material,160);inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);inst.frustumCulled=false;inst.count=0;inst.castShadow=false;inst.receiveShadow=false;scene.add(inst);batches.push({inst,offset:part.matrixWorld.clone()});});
  const matrix=new THREE.Matrix4();
  return {update(coins){for(const {inst,offset} of batches){let n=0;for(const coin of coins){if(coin.taken)continue;coin.mesh.updateMatrix();matrix.multiplyMatrices(coin.mesh.matrix,offset);inst.setMatrixAt(n++,matrix);if(n===160)break;}inst.count=n;inst.instanceMatrix.needsUpdate=true;}}};
}
