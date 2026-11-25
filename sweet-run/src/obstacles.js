import * as THREE from 'three';
import { ball, bake, beam, block, COCOA, CREAM, floor, glow, groupAt, HONEY, lantern, LEAF, MINT, PINK, sign, tube, WOOD } from './art.js';

function flag(group, x, y, z, color, size = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(-.19 * size, 0);
  shape.lineTo(0, -.46 * size);
  shape.lineTo(.19 * size, 0);
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), glow(color));
  mesh.position.set(x, y, z);
  group.add(mesh);
}

function basket(group) {
  block(group, '#b17a47', 0, .37, 0, 1.90, .68, .81);
  for (let i = 0; i < 4; i++) {
    block(group, i % 2 ? '#c88851' : HONEY, 0, .16 + i * .15, .407, 1.80, .044, .028);
  }
  for (const x of [-.61, .61]) block(group, '#986342', x, .39, .43, .09, .68, .035);
  block(group, PINK, 0, .76, 0, 1.98, .15, .89);
  for (const x of [-.7, -.35, 0, .35, .7]) block(group, CREAM, x, .843, 0, .13, .019, .8);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.24, .038, 7, 16, Math.PI), glow('#ad7142'));
  handle.position.set(0, .81, 0);
  group.add(handle);
}

function bunting(group) {
  for (const side of [-1, 1]) {
    tube(group, WOOD, side * 1.02, 1.21, -.07, .07, .10, 2.42);
    ball(group, HONEY, side * 1.02, 2.49, -.07, .12);
  }
  block(group, '#b76d74', 0, 1.47, 0, 1.91, .43, .27);
  beam(group, WOOD, [-1.02, 2.31, 0], [1.02, 2.31, 0], .035);
  for (let i = 0; i < 5; i++) flag(group, -.78 + i * .39, 2.29, .042, [PINK, MINT, HONEY][i % 3]);
  sign(group, '低头穿过', 0, 1.48, .14, 1.35, .285, '#f8d6b9', '#8e4b55');
}

function cart(group, moving = false) {
  const color = moving ? '#e58e6f' : '#6fa993';
  block(group, color, 0, .78, 0, 1.89, 1.16, 1.83);
  block(group, CREAM, 0, 1.36, 0, 2.03, .14, 1.96);
  for (const side of [-1, 1]) {
    for (const z of [-.60, .60]) {
      const wheel = tube(group, COCOA, side * .90, .28, z, .25, .25, .18, 14);
      wheel.rotation.z = Math.PI / 2;
      const rim = tube(group, HONEY, side * 1.006, .28, z, .112, .112, .055, 10);
      rim.rotation.z = Math.PI / 2;
      tube(group, WOOD, side * .85, 1.94, z, .042, .042, 1.14);
    }
  }
  block(group, moving ? '#96586e' : '#dc839d', 0, 2.51, 0, 2.15, .18, 2.05);
  for (let stripe = 0; stripe < 6; stripe++) block(group, CREAM, -.84 + stripe * .335, 2.61, 0, .15, .036, 2.02);
  for (const x of [-.72, 0, .72]) {
    tube(group, HONEY, x, 1.50, .28, .11, .16, .23);
    ball(group, x ? PINK : CREAM, x, 1.65, .28, .12, .10, .12);
  }
  sign(group, moving ? '横移点心车' : '点心车', 0, .84, .938, 1.51, .47, moving ? '#fff0b6' : '#f5e5c4');
  if (moving) {
    for (const x of [-.67, .67]) lantern(group, x, 1.43, .92, '#ffc463', .12);
  }
}

function log(group) {
  const trunk = tube(group, '#9b6049', 0, .46, .01, .44, .43, 1.93, 16);
  trunk.rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    const end = tube(group, '#e9af77', side * .973, .46, .01, .39, .39, .045, 16);
    end.rotation.z = Math.PI / 2;
    ball(group, '#bf7b5c', side * 1.006, .46, .015, .035, .24, .24);
    beam(group, '#8f5950', [side * .39, .69, -.21], [side * .62, .96, -.36], .08);
  }
  for (const x of [-.54, -.23, .35]) ball(group, PINK, x, .87 + (x < 0 ? .02 : .07), .17, .21, .13, .18);
}

function branch(group) {
  const trunk = '#995761';
  beam(group, trunk, [-1.02, .02, -.18], [-.94, 2.18, -.18], .105);
  beam(group, trunk, [1.03, .02, -.18], [.98, 1.85, -.18], .10);
  beam(group, '#a36264', [-1.02, 1.83, -.08], [1.04, 1.62, -.03], .15);
  for (let i = 0; i < 8; i++) {
    const x = -1 + i * .28;
    ball(group, i % 2 ? '#f2adc3' : '#dc7691', x, 1.64 + Math.sin(i) * .07, .015, .29, .28, .31);
  }
  for (const x of [-.64, .59]) ball(group, '#fde3c5', x, 1.82, .20, .12, .09, .12);
}

function hedge(group) {
  block(group, '#b18368', 0, .40, 0, 1.94, .71, 1.23);
  block(group, CREAM, 0, .78, 0, 2.03, .12, 1.31);
  for (const x of [-.63, 0, .63]) {
    ball(group, '#6b996e', x, 1.45, 0, .47, .75, .56);
    ball(group, LEAF, x, 2.23 + (x === 0 ? .18 : 0), 0, .39, .52, .45);
    ball(group, x === 0 ? '#ffe2a5' : '#ed8eab', x, 1.83, .49, .21, .20, .14);
  }
}

function gap(group) {
  // Top and inner walls read as a missing plank section in one lane.
  floor(group, glow('#315f6c'), 0, .045, 0, 2.11, 2.54);
  for (const edge of [-1, 1]) {
    block(group, '#804c3b', 0, .055, edge * 1.25, 2.20, .11, .11);
    block(group, '#db9c5f', 0, .075, edge * 1.32, 2.19, .13, .12);
    block(group, '#8f5745', edge * 1.09, .034, 0, .10, .10, 2.63);
  }
  for (const [x, z, length] of [[.3, -.6, .71], [-.42, .41, .62], [.58, .71, .28], [-.12, -.13, 1.21]]) {
    floor(group, glow('#62a6ab'), x, .054, z, length, .055);
  }
  for (const x of [-.69, 0, .69]) {
    floor(group, glow('#fbda9d'), x, .157, 1.38, .27, .12);
  }
}

function bridgeBeam(group) {
  for (const x of [-1.04, 1.04]) {
    block(group, '#7b5445', x, 1.09, 0, .17, 2.17, .22);
    block(group, '#d49358', x, .23, 0, .25, .32, .30);
  }
  block(group, '#ae7046', 0, 1.48, 0, 2.17, .47, .83);
  for (const x of [-.66, .66]) block(group, HONEY, x, 1.49, .42, .115, .43, .057);
  sign(group, '低梁', 0, 1.48, .45, .82, .26);
}

function hives(group) {
  for (const x of [-.48, .48]) {
    tube(group, '#bc7831', x, .61, 0, .36, .45, 1.14, 14);
    for (const y of [.27, .87]) tube(group, '#e9ae52', x, y, 0, .452 - y * .025, .452 - y * .025, .09, 14);
    tube(group, '#8d5545', x, 1.19, 0, .38, .38, .10, 14);
  }
  tube(group, '#d89233', 0, 1.80, -.04, .35, .49, 1.14, 16);
  tube(group, '#a56448', 0, 2.38, -.04, .36, .36, .14, 16);
  ball(group, '#f6be49', 0, 2.54, -.04, .255, .13, .25);
  sign(group, '蜂蜜', 0, 1.69, .395, .63, .335, '#ffe6a4');
}

function sweets(group) {
  block(group, '#d5768a', 0, .43, 0, 1.95, .82, .96);
  block(group, '#f6aeab', 0, .89, 0, 2.02, .14, 1.02);
  for (const x of [-.60, .60]) block(group, CREAM, x, .51, .49, .12, .89, .04);
  for (const x of [-.56, 0, .56]) ball(group, x ? '#fee3a2' : '#fff5d8', x, 1.03, 0, .21, .107, .19);
  sign(group, '点心箱', 0, .50, .506, 1.08, .30, '#fff0ce', '#8c4963');
}

function lanterns(group) {
  const post = '#99516d';
  for (const x of [-1.04, 1.04]) block(group, post, x, 1.28, 0, .14, 2.57, .17);
  block(group, post, 0, 2.43, 0, 2.13, .13, .20);
  for (let i = 0; i < 5; i++) {
    const x = .406 * (i - 2);
    const color = i % 2 ? '#ffd38c' : '#ff9998';
    beam(group, COCOA, [x, 2.38, 0], [x, 1.89, 0], .034);
    lantern(group, x, 1.66, 0, color, .32);
    block(group, glow('#e9837e'), x, 1.28, 0, .065, .20, .065, false);
  }
}

const makers = { basket, bunting, cart, log, branch, hedge, gap, beam: bridgeBeam, hives, shuttle: (group) => cart(group, true), sweets, lanterns };

export function makeObstacles() {
  return Object.fromEntries(Object.entries(makers).map(([type, make]) => {
    const group = new THREE.Group();
    make(group);
    return [type, bake(group)];
  }));
}

export function makeShuttleMarker() {
  const group = new THREE.Group();
  const board = groupAt(group, 0, 0, 0);
  for (const side of [-1, 1]) {
    floor(board, glow('#e89564'), side * .86, .05, 0, .083, 2.04);
    for (const z of [.75, 0, -.75]) {
      const bar = floor(board, glow('#f3ad72'), side * .58, .055, z, .44, .085);
      bar.rotation.y = side * .35;
    }
  }
  return bake(group);
}
