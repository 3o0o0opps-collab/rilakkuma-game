import * as THREE from 'three';
import { canvasMaterial, piece } from './art.js';

const spriteStyle = { transparent: true, alphaTest: .015, depthWrite: false, toneMapped: false, fog: false };
const brownOutline = '#65422f';

function textureFile(loader, file) {
  return loader.loadAsync(new URL(`../assets/${file}`, import.meta.url).href);
}

function makeFrontView(texture) {
  // Official waving illustration, trimmed in UV space to its visible bounds.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.offset.set(386 / 1280, 0);
  texture.repeat.set(509 / 1280, 1);
  const front = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ map: texture, ...spriteStyle });
  piece(front, new THREE.PlaneGeometry(2.10 * 509 / 720, 2.10), material, 0, 1.05, 0, 1, 1, 1, false);
  return front;
}

function coloredShape(context, outline, colors, height, stroke = 8) {
  const path = new Path2D(outline);
  const gradient = context.createLinearGradient(12, 11, 94, height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  context.fillStyle = gradient;
  context.fill(path);
  context.lineJoin = 'round';
  context.lineWidth = stroke;
  context.strokeStyle = brownOutline;
  context.stroke(path);
}

function makeBackHead(officialHead) {
  // Use the San-X illustration's actual ear and head silhouette as the mask.
  return canvasMaterial(400, 302, (context, width, height) => {
    const silhouette = (target, x, y, w, h) => {
      target.drawImage(officialHead, 29, 46, 143, 108, x, y, w, h);
    };
    silhouette(context, 0, 0, width, height);
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = brownOutline;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';

    const inner = document.createElement('canvas');
    inner.width = width;
    inner.height = height;
    const paint = inner.getContext('2d');
    silhouette(paint, 7, 7, width - 14, height - 14);
    paint.globalCompositeOperation = 'source-in';
    const honey = paint.createLinearGradient(86, 36, 315, height);
    honey.addColorStop(0, '#dfaa5a');
    honey.addColorStop(.46, '#cb8f36');
    honey.addColorStop(1, '#b87933');
    paint.fillStyle = honey;
    paint.fillRect(0, 0, width, height);
    context.drawImage(inner, 0, 0);

    context.globalCompositeOperation = 'source-atop';
    context.lineCap = 'round';
    context.strokeStyle = '#ae7538';
    context.lineWidth = 5;
    context.stroke(new Path2D('M 82 95 Q 66 108 53 132 M 321 93 Q 335 106 348 129'));
    context.strokeStyle = '#f6d49a';
    context.lineWidth = 6;
    context.stroke(new Path2D('M 72 149 Q 99 85 164 72'));
  }, spriteStyle);
}

function makeBackTorso() {
  return canvasMaterial(236, 270, (context) => {
    coloredShape(context,
      'M 44 75 C 49 35 74 19 115 19 C 158 19 181 39 190 77 C 202 119 205 183 187 218 C 167 251 70 255 47 218 C 29 190 35 120 44 75 Z',
      ['#d39a45', '#ae7132'], 264, 9);

    context.lineCap = 'round';
    context.lineWidth = 3;
    context.strokeStyle = '#a06a34';
    context.stroke(new Path2D('M 112 64 Q 123 113 119 177'));
    context.strokeStyle = '#6e4b34';
    context.lineWidth = 11;
    context.stroke(new Path2D('M 115 84 Q 124 126 119 175'));
    context.strokeStyle = '#eed1a1';
    context.lineWidth = 4;
    for (let y = 89; y < 171; y += 7) {
      const x = 116 + Math.sin((y - 83) / 92 * Math.PI) * 5;
      context.beginPath();
      context.moveTo(x - 2, y);
      context.lineTo(x + 2, y + 1);
      context.stroke();
    }
    coloredShape(context, 'M 111 81 Q 117 76 123 81 L 127 96 Q 122 103 115 100 Z', ['#f1cea0', '#cda675'], 140, 4);
    context.beginPath();
    context.ellipse(117, 207, 27, 25, -.11, 0, Math.PI * 2);
    const tail = context.createRadialGradient(109, 193, 4, 119, 207, 31);
    tail.addColorStop(0, '#ecb963');
    tail.addColorStop(1, '#bd7f35');
    context.fillStyle = tail;
    context.fill();
    context.strokeStyle = '#986031';
    context.lineWidth = 5;
    context.stroke();
  }, spriteStyle);
}

function makeLimb(isFoot) {
  const outline = isFoot
    ? 'M 40 15 C 58 10 76 23 79 49 C 82 65 83 78 90 97 C 102 124 85 142 57 145 C 31 149 12 134 12 111 C 12 89 21 51 24 34 C 27 24 32 17 40 15 Z'
    : 'M 59 12 C 84 15 90 38 85 70 C 81 96 72 121 61 135 C 48 150 28 144 22 125 C 14 107 24 80 28 61 C 32 32 42 11 59 12 Z';
  return canvasMaterial(104, 155, (context) => {
    coloredShape(context, outline, isFoot ? ['#d39a48', '#ad6d31'] : ['#dfa551', '#b77632'], 155, 7);
    if (isFoot) {
      context.beginPath();
      context.ellipse(55, 118, 24, 16, -.10, 0, Math.PI * 2);
      context.fillStyle = '#e9b052';
      context.fill();
    }
  }, spriteStyle);
}

function limb(parent, material, x, y, z, width, height, side) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const art = piece(pivot, new THREE.PlaneGeometry(width, height), material, 0, -.34 * height, 0, side, 1, 1, false);
  art.renderOrder = 1;
  parent.add(pivot);
  return pivot;
}

function makeRearView(officialHead) {
  // In world space the route goes towards -Z, so the back artwork faces +Z.
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const armMaterial = makeLimb(false);
  const footMaterial = makeLimb(true);
  const arms = [-1, 1].map((side) => limb(body, armMaterial, side * .37, 1.05, -.04, .36, .63, side));
  const legs = [-1, 1].map((side) => limb(body, footMaterial, side * .235, .45, -.035, .40, .51, side));
  const torso = piece(body, new THREE.PlaneGeometry(.94, 1.12), makeBackTorso(), 0, .73, .065, 1, 1, 1, false);
  torso.renderOrder = 2;
  const head = piece(body, new THREE.PlaneGeometry(1.63, 1.23), makeBackHead(officialHead), 0, 1.56, .086, 1, 1, 1, false);
  head.renderOrder = 3;

  function pose({ mode, turn, stride, crash, reduced }) {
    const step = mode === 'run' && !reduced ? Math.sin(stride) : 0;
    const slide = mode === 'slide';
    const falling = mode === 'crash';
    const jumping = mode === 'jump';
    root.rotation.y = -turn * .27;
    root.rotation.z = reduced ? 0 : -turn * .12 + step * .041;
    body.scale.y = slide ? .47 : falling ? 1 - crash * .44 : 1;
    body.rotation.x = slide ? -.64 : falling ? -.26 - crash * .25 : jumping ? -.20 : -.11;
    head.rotation.z = step * .024;

    for (const [index, side] of [-1, 1].entries()) {
      const swing = step * side;
      const arm = arms[index];
      const leg = legs[index];
      arm.rotation.x = slide ? -.34 : jumping ? .62 : swing * .73;
      arm.rotation.z = side * (slide ? .43 : jumping ? .66 : .09 + Math.abs(swing) * .24);
      leg.rotation.x = slide ? -.74 : jumping ? .53 : -.10 - swing * .88;
      leg.rotation.z = side * (slide ? .16 : jumping ? .21 : .06);
      leg.position.y = .45 + (jumping ? .12 : Math.max(0, swing) * .09);
    }
  }
  return { root, pose };
}

export async function makeRunner(scene) {
  const loader = new THREE.TextureLoader();
  const [wave, headTexture] = await Promise.all([
    textureFile(loader, 'rilakkuma-wave.png'),
    textureFile(loader, 'rilakkuma-head.png'),
  ]);
  const front = makeFrontView(wave);
  const rear = makeRearView(headTexture.image);
  headTexture.dispose();
  scene.add(front, rear.root);

  const shadowTexture = canvasMaterial(96, 96, (context) => {
    const gradient = context.createRadialGradient(48, 48, 4, 48, 48, 46);
    gradient.addColorStop(0, 'rgba(69,35,30,.43)');
    gradient.addColorStop(.6, 'rgba(69,35,30,.24)');
    gradient.addColorStop(1, 'rgba(69,35,30,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 96, 96);
  }, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const shadow = piece(scene, new THREE.PlaneGeometry(1.75, 1.18).rotateX(-Math.PI / 2), shadowTexture, 0, .027, 0, 1, 1, 1, false);
  const shield = piece(scene, new THREE.SphereGeometry(1, 22, 14),
    new THREE.MeshBasicMaterial({ color: '#f3a1af', transparent: true, opacity: .19, depthWrite: false, fog: false }),
    0, 0, 0, 1.06, 1.31, .96, false);
  shield.renderOrder = 4;

  return {
    draw(camera, pose) {
      const { x, y, z, scale, time, stride, mode, reduced } = pose;
      const onMenu = mode === 'menu';
      front.visible = onMenu;
      rear.root.visible = !onMenu;
      if (onMenu) {
        front.position.set(x, y + (reduced ? 0 : Math.abs(Math.sin(time * 2)) * .047), z);
        front.scale.setScalar(scale);
        front.quaternion.copy(camera.quaternion);
      } else {
        const bounce = mode === 'run' && !reduced ? Math.abs(Math.sin(stride)) * .086 : 0;
        rear.root.position.set(x, y + bounce, z);
        rear.root.scale.setScalar(scale);
        rear.pose(pose);
      }
      const floor = onMenu ? 0 : pose.floor;
      const aboveFloor = Math.max(0, y - floor);
      shadow.position.set(x, floor + .042, z);
      shadow.scale.setScalar(scale * (1 + aboveFloor * .13));
      shadow.material.opacity = 1 - Math.min(.58, aboveFloor * .24);
      shield.visible = !onMenu && Boolean(pose.shield);
      shield.position.set(x, y + (mode === 'slide' ? .58 : 1.06), z);
      shield.scale.y = mode === 'slide' ? .76 : 1.31;
    },
  };
}
