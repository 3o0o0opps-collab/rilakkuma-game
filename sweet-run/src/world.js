import * as THREE from 'three';
import { ball, bake, CREAM, HONEY, tube } from './art.js';
import { damp } from './rules.mjs?v=2';

const palettes = {
  town:   { sky: '#a5d6d2', horizon: '#f7d9b5', fog: '#dfd8bb', sun: '#fff0c9', hemi: '#fff0e2', ground: '#b5a589', direct: 2.25, ambient: 1.72, drift: '#f9b6bd' },
  grove:  { sky: '#e5a5c0', horizon: '#f8d2b9', fog: '#ecc2c5', sun: '#fff0be', hemi: '#ffddd6', ground: '#b9949f', direct: 2.02, ambient: 1.75, drift: '#ffbdcf' },
  river:  { sky: '#76bdca', horizon: '#f6d7a4', fog: '#b8d0bc', sun: '#ffe3a5', hemi: '#d8f4ec', ground: '#b0bc9b', direct: 2.22, ambient: 1.68, drift: '#fff2b1' },
  market: { sky: '#352e53', horizon: '#9e7181', fog: '#766587', sun: '#f9d4ac', hemi: '#f0c6d6', ground: '#8d7393', direct: 1.58, ambient: 1.36, drift: '#ffd58e' },
};
for (const palette of Object.values(palettes)) {
  for (const key of ['sky', 'horizon', 'fog', 'sun', 'hemi', 'ground', 'drift']) palette[key] = new THREE.Color(palette[key]);
}

const skyVertex = `
  varying vec3 direction;
  void main() {
    direction = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const skyFragment = `
  varying vec3 direction;
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 sunColor;
  uniform float night;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 17321.201);
  }
  void main() {
    vec3 ray = normalize(direction);
    float height = smoothstep(-.08, .65, ray.y);
    vec3 color = mix(horizonColor, topColor, height);
    vec3 light = normalize(vec3(.29, .24, -.92));
    float d = distance(ray, light);
    float halo = exp(-d * d * 66.);
    color = mix(color, sunColor, halo * (.23 - night * .12));
    color = mix(color, sunColor, (1. - smoothstep(.045, .051, d)) * .98);
    vec2 grid = vec2(atan(ray.x, -ray.z), asin(ray.y)) * 56.;
    vec2 cell = floor(grid);
    float random = hash(cell);
    vec2 star = vec2(hash(cell + 1.6), hash(cell + 7.1)) * .66 + .17;
    float speck = 1. - smoothstep(.014, .088, distance(fract(grid), star));
    color += vec3(1., .86, .56) * speck * step(.78, random) * smoothstep(.06, .45, ray.y) * night;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

function skyDome(scene) {
  const uniforms = {
    topColor: { value: palettes.town.sky.clone() },
    horizonColor: { value: palettes.town.horizon.clone() },
    sunColor: { value: palettes.town.sun.clone() },
    night: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(145, 32, 16), material);
  mesh.renderOrder = -10;
  scene.add(mesh);
  return { mesh, uniforms };
}

export function makeStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cedac7');
  scene.fog = new THREE.Fog(palettes.town.fog, 43, 101);
  const camera = new THREE.PerspectiveCamera(51, window.innerWidth / window.innerHeight, .12, 170);
  camera.position.set(0, 5.3, 10.7);
  const { mesh: sky, uniforms } = skyDome(scene);
  const hemi = new THREE.HemisphereLight(palettes.town.hemi, palettes.town.ground, palettes.town.ambient);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffedcf', palettes.town.direct);
  sun.position.set(-8, 21, 10);
  sun.target.position.set(0, 0, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 15, top: 20, bottom: -17, near: 1, far: 56 });
  sun.shadow.normalBias = .032;
  sun.shadow.bias = -.00018;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#e9eeff', .46);
  fill.position.set(10, 4, 7);
  scene.add(fill);

  const drifts = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 5, 3), new THREE.MeshBasicMaterial({ color: palettes.town.drift }), 46);
  drifts.frustumCulled = false;
  scene.add(drifts);
  const transform = new THREE.Object3D();

  function tick(t, district, dt, reduced) {
    const palette = palettes[district];
    const mix = damp(1.4, dt);
    sky.position.copy(camera.position);
    uniforms.topColor.value.lerp(palette.sky, mix);
    uniforms.horizonColor.value.lerp(palette.horizon, mix);
    uniforms.sunColor.value.lerp(palette.sun, mix);
    uniforms.night.value = THREE.MathUtils.lerp(uniforms.night.value, district === 'market' ? 1 : 0, mix);
    scene.fog.color.lerp(palette.fog, mix);
    hemi.color.lerp(palette.hemi, mix);
    hemi.groundColor.lerp(palette.ground, mix);
    hemi.intensity = THREE.MathUtils.lerp(hemi.intensity, palette.ambient, mix);
    sun.intensity = THREE.MathUtils.lerp(sun.intensity, palette.direct, mix);
    drifts.material.color.lerp(palette.drift, mix);
    const activeTime = reduced ? 0 : t;
    const night = district === 'market';
    for (let i = 0; i < drifts.count; i++) {
      const angle = i * 2.399;
      const y = night ? .55 + (i % 17) * .22 + Math.sin(activeTime * 1.72 + i) * .26 : (i * .71 - activeTime * .40 % 8 + 8) % 8 + .33;
      transform.position.set(Math.sin(angle) * 10.5 + Math.sin(activeTime * .49 + i) * 1.37, y,
        6 - (i * 3.71 + activeTime * (night ? 1.25 : 2.18)) % 53);
      transform.rotation.set(activeTime * .8 + i, i, activeTime * .5);
      const size = night ? .036 + .028 * (1 + Math.sin(i + activeTime * 3)) : .082;
      transform.scale.set(size, night ? size : size * .27, size);
      transform.updateMatrix();
      drifts.setMatrixAt(i, transform.matrix);
    }
    drifts.instanceMatrix.needsUpdate = true;
  }

  return { renderer, scene, camera, tick };
}

function makePudding() {
  const group = new THREE.Group();
  tube(group, CREAM, 0, -.16, 0, .34, .35, .058, 14, false);
  tube(group, HONEY, 0, .015, 0, .247, .299, .315, 14, false);
  tube(group, '#a26546', 0, .192, 0, .256, .241, .046, 14, false);
  ball(group, '#fff1d4', -.02, .236, 0, .087, .054, .083, false);
  ball(group, '#dd747d', .025, .282, 0, .050, .050, .052, false);
  return bake(group);
}

export function makePuddingBatch(scene) {
  const { children } = makePudding();
  const batches = children.map(({ geometry, material }) => {
    const mesh = new THREE.InstancedMesh(geometry, material, 128);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
    return mesh;
  });
  const transform = new THREE.Object3D();
  return {
    update(coins, distance, time, reduced) {
      let count = 0;
      for (const coin of coins) {
        const z = distance - coin.at;
        if (z > 8 || z < -91) continue;
        transform.position.set(coin.x, coin.y + (reduced ? 0 : Math.sin(time * 3.5 + coin.at * .39) * .05), z);
        transform.rotation.set(0, reduced ? 0 : time * .57 + coin.at * .04, 0);
        transform.updateMatrix();
        for (const batch of batches) batch.setMatrixAt(count, transform.matrix);
        count++;
        if (count === 128) break;
      }
      for (const batch of batches) {
        batch.count = count;
        batch.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

export function makeParticles(scene) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffdb83' }), 64);
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  const particles = Array.from({ length: 64 }, () => ({ life: 0 }));
  const transform = new THREE.Object3D();
  let cursor = 0;
  return {
    burst(x, y, z) {
      for (let i = 0; i < 7; i++) {
        const a = i * Math.PI * 2 / 7;
        Object.assign(particles[cursor++ % particles.length], { life: .43, x, y, z, vx: Math.cos(a) * 1.38, vy: 1.6 + Math.random(), vz: Math.sin(a) * 1.48 });
      }
    },
    update(dt) {
      let count = 0;
      for (const particle of particles) {
        if (particle.life <= 0) continue;
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.z += particle.vz * dt;
        particle.vy -= 4 * dt;
        transform.position.set(particle.x, particle.y, particle.z);
        transform.scale.setScalar(Math.max(0, particle.life) * .17);
        transform.updateMatrix();
        mesh.setMatrixAt(count++, transform.matrix);
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    },
    reset() {
      for (const particle of particles) particle.life = 0;
    },
  };
}
