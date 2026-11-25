import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const sphere = new THREE.SphereGeometry(1, 18, 12);
const smallSphere = new THREE.SphereGeometry(1, 10, 7);
const roundedBox = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3);
const point = new THREE.Vector3();
const core = new THREE.Vector3();
for (let index = 0; index < roundedBox.attributes.position.count; index++) {
  point.fromBufferAttribute(roundedBox.attributes.position, index);
  core.copy(point).clampScalar(-.38, .38);
  point.sub(core).normalize().multiplyScalar(.12).add(core);
  roundedBox.attributes.position.setXYZ(index, point.x, point.y, point.z);
}
roundedBox.computeVertexNormals();

const paintCache = new Map();
export function paint(color) {
  if (!paintCache.has(color)) {
    paintCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: .82 }));
  }
  return paintCache.get(color);
}

const glowCache = new Map();
export function glow(color) {
  if (!glowCache.has(color)) {
    glowCache.set(color, new THREE.MeshBasicMaterial({ color }));
  }
  return glowCache.get(color);
}

export const CREAM = '#fff0cc';
export const WOOD = '#af7451';
export const COCOA = '#65443d';
export const HONEY = '#ecaf45';
export const PINK = '#e7859b';
export const LEAF = '#72a77b';
export const MINT = '#76b6a7';

export function piece(group, geometry, color, x, y, z, sx = 1, sy = 1, sz = 1, shadow = true) {
  const mesh = new THREE.Mesh(geometry, typeof color === 'string' ? paint(color) : color);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function block(group, color, x, y, z, width, height, depth, shadow = true) {
  return piece(group, roundedBox, color, x, y, z, width, height, depth, shadow);
}

export function ball(group, color, x, y, z, sx, sy = sx, sz = sx, shadow = true) {
  const geometry = Math.max(sx, sy, sz) > 1 ? sphere : smallSphere;
  return piece(group, geometry, color, x, y, z, sx, sy, sz, shadow);
}

const cylinders = new Map();
export function tube(group, color, x, y, z, radiusTop, radiusBottom, height, sides = 12, shadow = true) {
  const key = [radiusTop, radiusBottom, height, sides].join(',');
  if (!cylinders.has(key)) cylinders.set(key, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides));
  return piece(group, cylinders.get(key), color, x, y, z, 1, 1, 1, shadow);
}

export function beam(group, color, a, b, radius, shadow = true) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const center = start.clone().lerp(end, .5);
  const rod = tube(group, color, center.x, center.y, center.z, radius, radius, start.distanceTo(end), 8, shadow);
  rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  return rod;
}

const floorGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export function floor(group, color, x, y, z, width, length) {
  return piece(group, floorGeometry, color, x, y, z, width, 1, length, false);
}

export function groupAt(parent, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

export function canvasMaterial(width, height, draw, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, ...options });
}

const signs = new Map();
const signGeometry = new THREE.PlaneGeometry(1, 1);
export function sign(group, text, x, y, z, width, height, paper = '#feeac4', ink = '#725044') {
  const key = [text, paper, ink].join(',');
  if (!signs.has(key)) {
    signs.set(key, canvasMaterial(512, 144, (context, w, h) => {
      context.fillStyle = paper;
      context.fillRect(0, 0, w, h);
      context.strokeStyle = ink;
      context.globalAlpha = .27;
      context.lineWidth = 4;
      context.strokeRect(12, 12, w - 24, h - 24);
      context.globalAlpha = 1;
      context.fillStyle = ink;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '700 49px Georgia, "PingFang SC", system-ui, sans-serif';
      context.fillText(text, w / 2, h / 2 + 1, w - 58);
    }));
  }
  block(group, WOOD, x, y, z - .05, width + .13, height + .12, .14);
  return piece(group, signGeometry, signs.get(key), x, y, z + .027, width, height, 1, false);
}

export function lantern(group, x, y, z, color, size = .26) {
  ball(group, glow(color), x, y, z, size * .91, size, size * .87, false);
  for (const edge of [-1, 1]) {
    tube(group, COCOA, x, y + edge * size * .79, z, size * .54, size * .54, .065, 10, false);
  }
}

const bakedPaint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82 });
// Bake a prop or tile once. Untextured pieces share vertex-colored meshes;
// signs and lantern lights retain their materials and receive separate batches.
export function bake(group) {
  group.updateMatrixWorld(true);
  const baked = new Map();
  group.traverse((object) => {
    if (!object.isMesh) return;
    const plain = object.material.isMeshStandardMaterial && !object.material.map;
    const material = plain ? bakedPaint : object.material;
    const key = `${material.id}:${object.castShadow}`;
    if (!baked.has(key)) baked.set(key, { material, castShadow: object.castShadow, geometries: [] });
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    if (plain) {
      const color = object.material.color;
      const values = new Float32Array(geometry.attributes.position.count * 3);
      for (let index = 0; index < values.length; index += 3) {
        values[index] = color.r;
        values[index + 1] = color.g;
        values[index + 2] = color.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
    }
    baked.get(key).geometries.push(geometry);
  });
  group.clear();
  for (const { material, castShadow, geometries } of baked.values()) {
    const merged = mergeGeometries(geometries);
    geometries.forEach((geometry) => geometry.dispose());
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
