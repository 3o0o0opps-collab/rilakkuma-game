import * as THREE from 'three';
import { ball, bake, beam, block, COCOA, CREAM, floor, glow, piece, sign, tube, WOOD } from './art.js';
import { CONFIG, DECK_HEIGHT, PICKUPS, surfaceHeight, TRAIN_LENGTH } from './rules.mjs?v=3';

export const SURFACE_MODEL_LENGTH = 10;
const turquoise = '#73a89a';
const gold = '#efbd65';

// The oncoming train faces +Z. The parked wagon's walkable top meets the ramp.
export function makeTrain(group, length = TRAIN_LENGTH, wagon = false) {
  const nose = length / 2;
  const baseColor = wagon ? turquoise : '#d78269';
  const roofColor = wagon ? '#f8d596' : '#b56e72';
  const height = wagon ? DECK_HEIGHT : 3.22;
  block(group, COCOA, 0, .40, 0, 1.97, .36, length - .24);
  block(group, baseColor, 0, 1.36, 0, 2.04, 1.85, length - .14);
  block(group, CREAM, 0, .78, 0, 2.08, .12, length - .08);
  block(group, roofColor, 0, height - .16, 0, 2.15, .32, length);
  block(group, '#eac59e', 0, height - .36, 0, 2.10, .09, length - .09);

  for (const side of [-1, 1]) {
    for (const z of [-nose + 1.32, -nose + 2.13, nose - 2.13, nose - 1.32]) {
      tube(group, '#684c50', side * .85, .26, z, .256, .256, .25, 14).rotation.z = Math.PI / 2;
      tube(group, gold, side * .994, .26, z, .10, .10, .047, 12).rotation.z = Math.PI / 2;
    }
    for (const fraction of [-.35, -.18, 0, .18, .35]) {
      const z = fraction * length;
      block(group, CREAM, side * 1.01, 1.71, z, .10, .88, length * .111);
      block(group, wagon ? '#739b9b' : '#7896a1', side * 1.066, 1.73, z, .04, .69, length * .086);
      block(group, '#c6e1d1', side * 1.086, 1.95, z, .027, .086, length * .072);
    }
  }

  if (wagon) {
    for (const x of [-.95, .95]) block(group, '#fff1cd', x, height + .065, 0, .08, .13, length - .19);
    for (const z of [-nose * .53, 0, nose * .53]) {
      floor(group, glow('#fff0ba'), 0, height + .015, z, 1.20, .047);
    }
  } else {
    block(group, '#d29866', 0, 1.98, nose - .061, 1.76, 1.08, .18);
    for (const side of [-1, 1]) {
      block(group, '#8aa8ab', side * .426, 2.05, nose + .034, .69, .69, .08);
      block(group, '#bcd9cb', side * .43, 2.24, nose + .077, .48, .081, .018);
      ball(group, '#ba7c57', side * .69, .97, nose + .019, .253, .245, .106);
      ball(group, glow('#fff6b5'), side * .69, .97, nose + .103, .159, .156, .048, false);
    }
    block(group, '#855a61', 0, .45, nose + .03, 1.99, .25, .28);
    for (const x of [-.63, -.32, 0, .32, .63]) block(group, '#f4bd71', x, .45, nose + .179, .128, .18, .02);
    sign(group, '蜂蜜列车', 0, 2.66, nose - .01, 1.34, .34, '#f9d48c', '#824e4d');
  }
}

export function makeRollingCandy(group) {
  const shape = new THREE.SphereGeometry(.706, 20, 16);
  const colors = ['#e27e9c', '#f9caac', '#e88da7', '#fff0c4'];
  for (let segment = 0; segment < 8; segment++) {
    const stripe = new THREE.SphereGeometry(.719, 6, 16, segment * Math.PI / 4, Math.PI / 4);
    piece(group, stripe, colors[segment % colors.length], 0, 0, 0);
  }
  piece(group, shape, '#d8839e', 0, 0, 0);
  for (const z of [-.69, .69]) ball(group, CREAM, 0, 0, z, .125, .125, .054);
}

function profile(group, type, color) {
  const length = SURFACE_MODEL_LENGTH;
  const surface = { type, start: 0, end: length };
  const positions = [], uv = [], indices = [];
  const sections = 14;
  for (let i = 0; i <= sections; i++) {
    const progress = i / sections;
    const y = .035 + surfaceHeight(surface, progress * length);
    const z = length * (.5 - progress);
    positions.push(-1.10, y, z, 1.10, y, z);
    uv.push(0, progress, 1, progress);
    if (i) {
      const left = (i - 1) * 2;
      indices.push(left, left + 1, left + 2, left + 1, left + 3, left + 2);
    }
  }
  const bed = new THREE.BufferGeometry();
  bed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bed.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  bed.setIndex(indices);
  bed.computeVertexNormals();
  piece(group, bed, color, 0, 0, 0);
  for (const side of [-1, 1]) {
    let last;
    for (let i = 0; i <= sections; i++) {
      const distance = length * i / sections;
      const point = [side * 1.055, surfaceHeight(surface, distance) + .104, length / 2 - distance];
      if (last) beam(group, type === 'slide' ? '#f4c1c5' : '#ce9c65', last, point, .084);
      last = point;
      if (i % 4 === 2 && point[1] > .55) block(group, WOOD, side * .93, point[1] / 2, point[2], .13, point[1], .14);
    }
  }
  for (const distance of [2.5, 5.0, 7.5]) {
    const z = length / 2 - distance;
    const y = surfaceHeight(surface, distance) + .085;
    for (const direction of [-1, 1]) beam(group, glow('#fff1ca'), [0, y, z - .20], [direction * .37, y, z + .16], .033, false);
  }
}

function canopy(group) {
  const length = SURFACE_MODEL_LENGTH;
  block(group, '#b77f9d', 0, DECK_HEIGHT - .125, 0, 2.20, .25, length);
  floor(group, '#f0b8ca', 0, DECK_HEIGHT + .006, 0, 2.18, length);
  for (const side of [-1, 1]) {
    block(group, '#ffe0c0', side * 1.059, DECK_HEIGHT + .064, 0, .10, .13, length);
    for (const z of [-3.6, 0, 3.6]) {
      beam(group, '#ac7294', [side * 1.06, .13, z], [side * .98, DECK_HEIGHT - .12, z], .089);
      ball(group, '#fac8c1', side * 1.052, DECK_HEIGHT + .14, z, .133);
    }
  }
  for (let i = -4; i <= 4; i++) floor(group, glow('#ffe5cc'), 0, DECK_HEIGHT + .013, i, 1.74, .043);
}

function spring(group) {
  tube(group, turquoise, 0, .092, 0, .83, .96, .18, 20);
  tube(group, CREAM, 0, .195, 0, .685, .73, .068, 20);
  const coil = new THREE.CatmullRomCurve3(Array.from({ length: 47 }, (_, i) => {
    const angle = i * Math.PI * .15;
    return new THREE.Vector3(.43 * Math.cos(angle), .166 + .0042 * i, .43 * Math.sin(angle));
  }));
  piece(group, new THREE.TubeGeometry(coil, 48, .061, 6, false), '#b096ad', 0, 0, 0);
  tube(group, '#e59ab3', 0, .438, 0, .75, .69, .145, 20);
  tube(group, '#ffd9bf', 0, .514, 0, .63, .63, .054, 20);
  for (const direction of [-1, 1]) beam(group, glow('#a55f83'), [0, .554, -.33], [direction * .27, .554, 0], .054, false);
  beam(group, glow('#a55f83'), [0, .554, -.32], [0, .554, .33], .054, false);
}

function pickup(type) {
  const group = new THREE.Group();
  const color = PICKUPS[type].color;
  piece(group, new THREE.TorusGeometry(.49, .062, 8, 24), glow(color), 0, 0, .01, 1, 1, 1, false);
  ball(group, '#fff0d4', 0, 0, -.069, .46, .46, .075, false);
  if (type === 'shield') {
    const shape = new THREE.Shape();
    shape.moveTo(0, -.30);
    shape.quadraticCurveTo(-.32, -.15, -.28, .21);
    shape.quadraticCurveTo(-.15, .23, 0, .31);
    shape.quadraticCurveTo(.15, .23, .28, .21);
    shape.quadraticCurveTo(.32, -.15, 0, -.30);
    piece(group, new THREE.ExtrudeGeometry(shape, { depth: .12, bevelEnabled: false }), glow('#c27891'), 0, 0, 0, 1, 1, 1, false);
    ball(group, CREAM, 0, .047, .131, .098, .100, .027, false);
  } else if (type === 'magnet') {
    const magnet = piece(group, new THREE.TorusGeometry(.208, .091, 8, 20, Math.PI), turquoise, 0, .07, .058, 1, 1, 1, false);
    magnet.rotation.z = Math.PI;
    for (const x of [-.208, .208]) block(group, '#efb65d', x, .135, .057, .165, .15, .16, false);
  } else {
    sign(group, '×2', 0, .012, .018, .57, .31, '#f7d689', '#855534');
  }
  return bake(group);
}

export function makeRouteProps() {
  const surfaces = {};
  for (const type of ['ramp', 'wagon', 'slide', 'canopy']) {
    const group = new THREE.Group();
    if (type === 'wagon') makeTrain(group, SURFACE_MODEL_LENGTH, true);
    else if (type === 'canopy') canopy(group);
    else profile(group, type, type === 'slide' ? '#cd83aa' : '#dca96b');
    surfaces[type] = bake(group);
  }
  const springModel = new THREE.Group();
  spring(springModel);
  const rail = new THREE.Group();
  for (const x of [-.65, .65]) block(rail, '#869c91', x, .046, 0, .103, .060, 37, false);
  for (let z = -17.5; z < 18; z += 1.1) block(rail, '#a27a64', 0, .035, z, 1.66, .046, .11, false);
  const candyTrack = new THREE.Group();
  for (const z of [-.63, .63]) {
    floor(candyTrack, glow('#f3d0a4'), 0, .049, z, CONFIG.laneWidth + 1.53, .089);
    for (const x of [-1.6, -.8, 0, .8, 1.6]) {
      floor(candyTrack, glow('#e9ad85'), x, .052, z, .23, .066).rotation.y = Math.PI / 5;
    }
  }
  return {
    surfaces, spring: bake(springModel), rail: bake(rail), candyTrack: bake(candyTrack),
    pickups: Object.fromEntries(Object.keys(PICKUPS).map((type) => [type, pickup(type)])),
  };
}
