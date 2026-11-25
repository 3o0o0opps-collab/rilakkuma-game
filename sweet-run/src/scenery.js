import * as THREE from 'three';
import { districtAt, isDistrictEntrance, TILE_LENGTH } from './rules.mjs?v=2';
import { ball, bake, beam, block, COCOA, CREAM, floor, glow, groupAt, HONEY, lantern, LEAF, MINT, PINK, piece, sign, tube, WOOD } from './art.js';

const shopColors = [
  ['#f2c5a7', '#d97b85', 'PUDDING'],
  ['#dbe0b4', '#79ad91', 'BAKERY'],
  ['#e9bd96', '#cd885d', 'HONEY CAFÉ'],
  ['#e5ccd6', '#aa8db4', 'FLOWERS'],
];
const glass = '#91b7ae';
const roofGeometry = new THREE.ConeGeometry(1, 1, 4);
const postColors = { town: '#bd8263', grove: '#ba768e', river: '#ad7647', market: '#835d7e' };
const laneColors = { town: '#fbe2bb', grove: '#fbe0d4', river: '#f7d29c', market: '#eec4a0' };
const roadColors = { town: '#dbb18e', grove: '#d38e9c', river: '#a87759', market: '#785a75' };

function canopy(group, centerY, front, color, width) {
  const awning = groupAt(group, 0, centerY, front);
  awning.rotation.x = .21;
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * width / 9;
    const stripe = i % 2 ? CREAM : color;
    block(awning, stripe, x, 0, .18, width / 9 + .013, .075, 1.11);
    ball(awning, stripe, x, -.055, .72, width / 18, .12, .064);
  }
}

function pot(group, x, y, z, color) {
  tube(group, '#d8976e', x, y + .15, z, .21, .16, .30, 10);
  ball(group, LEAF, x, y + .31, z, .24, .12, .23);
  beam(group, '#678c67', [x, y + .29, z], [x, y + .51, z], .027, false);
  ball(group, color, x, y + .57, z, .163, .142, .11, false);
  ball(group, HONEY, x, y + .57, z + .102, .051, .056, .035, false);
}

function shop(parent, x, z, index) {
  const house = groupAt(parent, x, 0, z);
  const side = Math.sign(x);
  house.rotation.y = -side * (Math.PI / 2 - .24);
  const [wall, trim, label] = shopColors[index % shopColors.length];
  const height = 4.65 + (index % 3) * .39;
  block(house, wall, 0, height * .5, 0, 5.18, height, 4.18);
  block(house, '#e9cdac', 0, .17, 2.07, 5.2, .34, .22);
  const roof = piece(house, roofGeometry, trim, 0, height + .42, 0, 4.03, 1.55, 3.45);
  roof.rotation.y = Math.PI / 4;
  block(house, trim, 0, height + .02, 0, 5.77, .18, 4.72);
  block(house, '#b47d65', 1.39, height + .63, -.79, .57, 1.40, .59);
  block(house, CREAM, 1.39, height + 1.32, -.79, .69, .15, .69);
  block(house, '#9b705c', 0, 1.24, 2.12, .96, 2.41, .14);
  block(house, glass, 0, 1.43, 2.21, .69, 1.71, .038);
  ball(house, HONEY, .31, 1.19, 2.23, .048);
  for (const wing of [-1, 1]) {
    const center = wing * 1.54;
    block(house, CREAM, center, 1.56, 2.13, 1.46, 1.58, .15);
    block(house, glass, center, 1.56, 2.23, 1.23, 1.35, .052);
    block(house, CREAM, center, 1.57, 2.266, .061, 1.31, .058);
    block(house, CREAM, center, 1.56, 2.266, 1.23, .058, .058);
    block(house, CREAM, center, height - .72, 2.12, .84, .80, .12);
    block(house, glass, center, height - .72, 2.20, .63, .60, .046);
    block(house, '#b98063', center, .77, 2.24, 1.48, .18, .36);
    for (const offset of [-.40, 0, .40]) pot(house, center + offset, .80, 2.33, wing > 0 ? trim : '#e7ab57');
  }
  canopy(house, 2.73, 2.44, trim, 5.1);
  sign(house, label, 0, 3.46, 2.17, 3.98, .65);
}

function tree(parent, x, z, blossom, size, variant) {
  const group = groupAt(parent, x, 0, z);
  group.scale.setScalar(size);
  const bark = blossom ? '#925f55' : '#9a7758';
  tube(group, bark, 0, 1.46, 0, .145, .246, 2.92, 9);
  beam(group, bark, [0, 1.65, -.05], [-.91, 2.97, .09], .126);
  beam(group, bark, [0, 1.69, -.07], [.88, 2.86, -.18], .125);
  const colors = blossom ? ['#d47795', '#e594aa', '#f2b0be', '#f8c7c7'] : ['#659d77', '#81b688', '#98c092', '#bad29b'];
  const crowns = [[0, 3.68, -.14, 1.02], [-1.13, 3.59, .07, 1.08], [1.02, 3.54, .2, 1.02],
    [-.56, 4.37, .08, 1.11], [.57, 4.47, -.11, .99], [-.04, 3.92, .93, .77], [-.07, 4.04, -.91, .92]];
  for (const [index, [cx, cy, cz, radius]] of crowns.entries()) {
    ball(group, colors[(index + variant) % colors.length], cx, cy, cz, radius, radius * .76, radius);
  }
  if (blossom) {
    for (const [cx, cy, cz] of [[-.84, 3.77, 1.0], [.56, 3.4, 1.15], [.28, 4.38, .96], [1.18, 3.70, .94]]) {
      ball(group, '#f3a4ad', cx, cy, cz, .36, .24, .28, false);
      ball(group, '#ffe0c2', cx, cy + .18, cz + .20, .096, .09, .07, false);
    }
  }
}

function sideLamp(group, x, z, market = false) {
  tube(group, '#7b6150', x, 1.64, z, .059, .083, 3.24, 8);
  tube(group, '#ae8261', x, .16, z, .14, .18, .32, 9);
  const direction = x < 0 ? 1 : -1;
  beam(group, '#7b6150', [x, 3.15, z], [x + direction * .42, 3.29, z], .048);
  lantern(group, x + direction * .42, 3.055, z, market ? '#ffba73' : '#fff1bb', market ? .28 : .19);
}

function bench(group, x, z) {
  const seat = groupAt(group, x, 0, z);
  seat.rotation.y = -Math.sign(x) * Math.PI / 2;
  for (const leg of [-.72, .72]) block(seat, COCOA, leg, .28, 0, .11, .54, .58);
  for (let i = 0; i < 3; i++) {
    block(seat, WOOD, 0, .58, -.21 + i * .21, 1.82, .11, .17);
    block(seat, WOOD, 0, .83 + i * .16, -.33, 1.82, .11, .091);
  }
}

function town(group, variant) {
  floor(group, '#a9bd8b', 0, -.04, 0, 76, TILE_LENGTH);
  for (const side of [-1, 1]) {
    block(group, '#d59693', side * 4.99, .075, 0, 1.56, .16, TILE_LENGTH, false);
    block(group, '#f2c9a8', side * 4.27, .09, 0, .105, .18, TILE_LENGTH);
    for (const z of [-10.5, 4, 13.5]) pot(group, side * 5.23, .16, z, side > 0 ? PINK : '#e2ae62');
    sideLamp(group, side * 4.82, -13);
    sideLamp(group, side * 4.86, 8);
    for (let i = 0; i < 3; i++) shop(group, side * (8.03 + i % 2 * .28), -11.1 + i * 11.1, variant + i + (side > 0 ? 2 : 0));
    tree(group, side * 6.35, -5.1, side > 0, .80, variant);
    bench(group, side * 5.92, 6);
  }
}

function picnic(group, x, z, variant) {
  const blanket = groupAt(group, x, .012, z);
  blanket.rotation.y = .22;
  const color = variant ? '#cb809a' : '#d78d7e';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) floor(blanket, (row + col) % 2 ? CREAM : color, (col - 2) * .42, .025, (row - 2) * .37, .42, .37);
  }
  block(blanket, WOOD, .55, .26, -.27, .64, .49, .52);
  block(blanket, CREAM, .55, .53, -.27, .67, .11, .53);
  tube(blanket, '#f0ad60', -.41, .19, .31, .16, .18, .26, 12);
  ball(blanket, '#f3cf82', -.41, .34, .31, .16, .091, .16);
}

function grove(group, variant) {
  floor(group, '#9fbf8f', 0, -.03, 0, 86, TILE_LENGTH);
  for (const side of [-1, 1]) {
    floor(group, '#e9afaa', side * 4.62, .012, 0, .99, TILE_LENGTH);
    for (let i = 0; i < 6; i++) {
      const z = -14 + 5.55 * i;
      block(group, '#f7d5b4', side * 5.18, .34, z, .125, .64, .13);
      ball(group, '#f9c89c', side * 5.18, .72, z, .11);
      if (i !== 5) block(group, '#e5b58e', side * 5.18, .43, z + 2.78, .093, .12, 5.55);
    }
    tree(group, side * 7.08, -10 + variant, true, 1.30, variant);
    tree(group, side * 6.58, 6.3, true, 1.09, variant + 1);
    tree(group, side * 12.7, -2.2, true, 1.61, variant + 2);
    tree(group, side * 11.7, 13.5, false, 1.10, variant);
    picnic(group, side * 8.82, -3.6, variant);
    for (let i = 0; i < 9; i++) {
      const z = -13.8 + i * 3.35;
      const x = side * (4.61 + (i % 2) * .24);
      const color = i % 3 ? '#f5bac9' : '#f8dda5';
      ball(group, color, x, .07, z, .14, .049, .11, false);
    }
    if (variant === 0) {
      for (const z of [-12, -8]) block(group, WOOD, side * 11.4, 1.47, z, .16, 2.94, .16);
      block(group, '#c8868e', side * 11.4, 3.06, -10, 2.10, .15, 4.6);
      bench(group, side * 10.80, -10);
    }
  }
}

function river(group, variant) {
  floor(group, '#65aaa7', 0, -.21, 0, 105, TILE_LENGTH);
  for (let i = 0; i < 33; i++) {
    // Subtle alternating boards make forward motion readable on the bridge.
    floor(group, ['#b78357', '#c18f62', '#b3835d', '#c18b5c'][(i + variant) % 4], 0, .019, -15.52 + i * .971, 8.58, .935);
  }
  for (const side of [-1, 1]) {
    block(group, '#9d6850', side * 4.44, .61, 0, .16, .19, TILE_LENGTH);
    block(group, '#dbab6f', side * 4.44, 1.03, 0, .20, .17, TILE_LENGTH);
    for (let i = 0; i < 9; i++) {
      const z = -14.6 + i * 3.66;
      block(group, '#966748', side * 4.44, .52, z, .19, 1.12, .19);
      block(group, '#f1c384', side * 4.44, 1.12, z, .24, .135, .24);
    }
    sideLamp(group, side * 4.84, variant ? -4.9 : 8.4);
    for (let i = 0; i < 12; i++) {
      const x = side * (5.1 + (i % 5) * 1.53);
      const z = ((i * 6.77 + variant * 4) % 29) - 14.5;
      floor(group, glow(i % 5 ? '#89c9bf' : '#b9e0c4'), x, -.188, z, .36 + (i % 3) * .47, .055);
      if (i % 3 !== 0) continue;
      ball(group, '#629b75', x + side * .49, -.125, z + .72, .57, .042, .43, false);
      ball(group, '#f0b7bd', x + side * .49, -.009, z + .72, .18, .14, .19, false);
    }
    const shore = side * 15.9;
    ball(group, '#9fbb84', shore, -.12, 1.6, 7.3, .43, 8.4, false);
    tree(group, shore - side * .4, -1.2, false, 1.25, variant + 1);
    tree(group, shore + side * 1.8, 7.3, false, .96, variant);
    if (variant === 1) {
      const honeyShed = groupAt(group, side * 12.4, .16, 3.8);
      honeyShed.rotation.y = -side * .78;
      block(honeyShed, '#d9a462', 0, 1.39, 0, 3.84, 2.78, 2.81);
      block(honeyShed, '#845441', 0, 3.01, 0, 4.06, .44, 3.27);
      sign(honeyShed, 'HONEY', 0, 2.08, 1.44, 2.8, .62);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(.96, .096, 6, 18), glow('#966a58'));
      wheel.position.set(-1.75, 1.20, 1.48);
      honeyShed.add(wheel);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        beam(honeyShed, WOOD, [-1.75, 1.2, 1.5], [-1.75 + Math.cos(a), 1.2 + Math.sin(a), 1.5], .047);
      }
    }
  }
}

function stall(group, x, z, index) {
  const shop = groupAt(group, x, 0, z);
  shop.rotation.y = -Math.sign(x) * (Math.PI / 2 - .28);
  const accent = ['#ac6681', '#c47872', '#766b97'][index % 3];
  block(shop, '#8f624c', 0, .63, .12, 3.92, 1.23, 2.09);
  block(shop, '#c28c67', 0, 1.27, .20, 4.18, .16, 2.24);
  block(shop, '#785c76', 0, 2.30, -.91, 3.81, 2.11, .19);
  for (const x of [-1.79, 1.79]) {
    block(shop, '#8a5f60', x, 1.87, 1.03, .15, 3.72, .15);
    lantern(shop, x, 2.79, 1.25, '#ffb381', .24);
  }
  block(shop, accent, 0, 3.63, 0, 4.21, .15, 2.28);
  canopy(shop, 3.32, .97, accent, 4.14);
  sign(shop, ['蜜糖点心', '暖灯小铺', '布丁工房'][index % 3], 0, 3.81, 1.09, 3.1, .55, '#f7cf9f', '#623e54');
  for (let i = 0; i < 7; i++) {
    const x = -.48 * (3 - i);
    const color = i % 2 ? '#ffc977' : '#e78d92';
    tube(shop, color, x, 1.41, .80, .12, .159, .21, 9);
    ball(shop, '#ffe5b4', x, 1.60, .80, .139, .108, .13);
  }
}

function lanternString(group, z) {
  for (const side of [-1, 1]) block(group, '#70566e', side * 5.1, 3.67, z, .15, 7.34, .15);
  let previous = [-5.1, 7.32, z];
  for (let i = 0; i <= 12; i++) {
    const x = (i - 6) * .85;
    const height = 6.50 + .82 * (x / 5.1) ** 2;
    const point = [x, height, z];
    if (i > 0) beam(group, '#5d4567', previous, point, .025, false);
    if (i % 2 === 1) lantern(group, x, height - .22, z, i % 4 === 1 ? '#ffad8d' : '#ffce81', .216);
    previous = point;
  }
}

function market(group, variant) {
  floor(group, '#635b74', 0, -.05, 0, 86, TILE_LENGTH);
  for (const side of [-1, 1]) {
    block(group, '#bd8992', side * 4.93, .07, 0, 1.38, .16, TILE_LENGTH, false);
    for (let i = 0; i < 3; i++) stall(group, side * 7.5, -10.7 + i * 10.7, variant + i + (side > 0 ? 1 : 0));
    sideLamp(group, side * 5.17, 7.5, true);
    const skyline = groupAt(group, side * 13.5, 0, variant ? 1.2 : -3.9);
    block(skyline, '#806c8e', 0, 2.61, 0, 5.6, 5.21, 4.8);
    const roof = piece(skyline, roofGeometry, '#544b71', 0, 5.74, 0, 4.6, 1.44, 4.0);
    roof.rotation.y = Math.PI / 4;
    for (let i = 0; i < 4; i++) block(skyline, glow('#f0ae71'), -.71 + i * .51, 3.4, 2.42, .26, .61, .03, false);
  }
  lanternString(group, -8.2);
  lanternString(group, 10.7);
}

function gate(group, district) {
  const gate = groupAt(group, 0, 0, 13.85);
  const color = postColors[district.id];
  for (const side of [-1, 1]) {
    const x = side * 4.71;
    block(gate, color, x, 3.48, 0, .27, 6.96, .30);
    block(gate, CREAM, x, .38, 0, .46, .75, .45);
    ball(gate, HONEY, x, 7.01, 0, .21);
    lantern(gate, side * 3.84, 6.09, 0, '#ffc386', .235);
  }
  block(gate, color, 0, 6.73, 0, 9.72, .21, .28);
  sign(gate, district.label, 0, 6.63, .14, 3.9, .74, district.id === 'market' ? '#f5c68e' : '#fbe6be');
}

const sides = { town, grove, river, market };
function buildTile(district, variant, entrance) {
  const group = new THREE.Group();
  floor(group, roadColors[district.id], 0, .008, 0, 8.6, TILE_LENGTH);
  sides[district.id](group, variant);
  for (const x of [-1.20, 1.20]) {
    for (let i = 0; i < 10; i++) floor(group, laneColors[district.id], x, .027, -14.4 + i * 3.2, .060, 1.24);
  }
  if (entrance) gate(group, district);
  return bake(group);
}

export function makeTrack(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const templates = new Map();
  const active = new Map();
  let currentIndex = null;

  function addTile(index) {
    const district = districtAt(index * TILE_LENGTH);
    const entrance = isDistrictEntrance(index);
    const variant = Math.abs(index) % 2;
    const key = `${district.id}:${entrance ? 'entrance' : variant}`;
    if (!templates.has(key)) templates.set(key, buildTile(district, variant, entrance));
    const tile = templates.get(key).clone();
    active.set(index, tile);
    root.add(tile);
  }

  return {
    update(distance) {
      const index = Math.floor(distance / TILE_LENGTH);
      if (index !== currentIndex) {
        currentIndex = index;
        for (const [oldIndex, tile] of active) {
          if (oldIndex >= index - 1 && oldIndex <= index + 4) continue;
          root.remove(tile);
          active.delete(oldIndex);
        }
        for (let next = index - 1; next <= index + 4; next++) if (!active.has(next)) addTile(next);
      }
      for (const [tileIndex, tile] of active) {
        tile.position.z = distance - (tileIndex + .5) * TILE_LENGTH;
        tile.visible = tile.position.z > -108 && tile.position.z < 48;
      }
    },
    get size() { return active.size; },
  };
}
