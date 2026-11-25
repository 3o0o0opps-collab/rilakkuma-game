import { CONFIG, clamp, collision, createCourse, damp, districtAt, followSurface, hitsSpring, laneX,
  loadRecord, OBSTACLES, obstacleX, obstacleZ, paceAt, PICKUPS, reachesPickup } from './rules.mjs?v=3';
import { makeStage, makeParticles, makePuddingBatch } from './world.js?v=3';
import { makeTrack } from './scenery.js?v=3';
import { makeObstacles, makeShuttleMarker } from './obstacles.js?v=3';
import { makeRouteProps, SURFACE_MODEL_LENGTH } from './features.js?v=3';
import { makeRunner } from './runner.js?v=3';
import { SweetAudio } from './audio.js?v=3';

// Adapted from Mohamed Amine Dehane's Subway Rush (MIT).
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const inspectRun = new URLSearchParams(window.location.search).has('qa');
const ahead = 93;
const tutorial = $('tutorial');
const scoreHud = $('score-hud');
const coinHud = $('coins-hud');
const districtBadge = $('district-name');
const powerHud = $('power-hud');
let stage, runner, track, particles, puddings, prototypes, routeProps, markerModels;

try {
  stage = makeStage(canvas);
  runner = await makeRunner(stage.scene);
  track = makeTrack(stage.scene);
  track.update(0);
  particles = makeParticles(stage.scene);
  puddings = makePuddingBatch(stage.scene);
  prototypes = makeObstacles();
  routeProps = makeRouteProps();
  markerModels = { shuttle: makeShuttleMarker(), train: routeProps.rail, roller: routeProps.candyTrack };
} catch (error) {
  const loading = $('loading');
  loading.querySelector('p').textContent = '小镇暂时没能打开，请刷新后重试。';
  const retry = document.createElement('button');
  retry.textContent = '重新打开';
  retry.addEventListener('click', () => location.reload());
  loading.append(retry);
  throw error;
}

const { renderer, scene, camera } = stage;
const audio = new SweetAudio();
const obstaclePool = Object.fromEntries(Object.keys(prototypes).map((type) => [type, []]));
const markerPools = Object.fromEntries(Object.keys(markerModels).map((type) => [type, []]));
const obstacles = [];
const coins = [];
const surfaces = [];
const springs = [];
const pickups = [];
const guideRows = [];
const storage = (() => {
  try { return window.localStorage; } catch { return null; }
})();
const game = { state: 'menu', best: loadRecord(storage) };
let course, nextRow, gesture;
let accumulator = 0, lastTime = 0, time = 0, homeBlend = 1;
let district, displayedDistance = -1, displayedCoins = -1, displayedPowers = '', visibleHint = '';
let metricTime = 0, metricFrames = 0;

function setState(state) {
  game.state = state;
  document.body.dataset.state = state;
  $('hud').hidden = state === 'menu';
  $('over').hidden = state !== 'over';
  $('pause').hidden = state !== 'paused';
  tutorial.hidden = state !== 'playing' || !visibleHint;
}

function updateBest() {
  $('home-best').textContent = `${game.best.toLocaleString()} 米`;
  $('best-hud').textContent = game.best.toLocaleString();
}

function saveBest() {
  const distance = Math.floor(game.distance);
  if (distance <= game.best) return;
  game.best = distance;
  try { storage?.setItem('rilakkumaSweetRun.best', String(game.best)); } catch { /* The current score stays in memory. */ }
  updateBest();
}

function changeDistrict(value) {
  if (district === value) return;
  district = value;
  document.body.dataset.district = district.id;
  districtBadge.textContent = district.label;
}

function reset() {
  for (const obstacle of obstacles) recycle(obstacle);
  obstacles.length = 0;
  for (const list of [surfaces, springs, pickups]) {
    for (const prop of list) scene.remove(prop.mesh);
    list.length = 0;
  }
  coins.length = 0;
  guideRows.length = 0;
  particles.reset();
  Object.assign(game, {
    lane: 1, x: 0, y: 0, vy: 0, floor: 0, grounded: true, sliding: false, rollTimer: 0, jumpBuffer: 0,
    speed: CONFIG.startSpeed, distance: 0, coins: 0, phase: 0, crashTime: 0, toastTime: 0,
    shield: 0, magnet: 0, double: 0, grace: 0, launches: 0, lastHit: '',
  });
  displayedDistance = -1;
  displayedCoins = -1;
  visibleHint = '';
  tutorial.hidden = true;
  $('toast').classList.remove('show');
  accumulator = 0;
  gesture = null;
  course = createCourse();
  nextRow = course.next();
  track.update(0);
  changeDistrict(districtAt(0));
  for (const at of [4, 7, 10]) addCoin(1, .91, at);
  spawnAhead();
}

function start() {
  audio.start();
  reset();
  setState('playing');
  audio.effect('start');
  canvas.focus({ preventScroll: true });
}

function home() {
  saveBest();
  reset();
  setState('menu');
  $('play-btn').focus({ preventScroll: true });
}

function togglePause() {
  if (game.state === 'playing') {
    gesture = null;
    setState('paused');
    $('resume-btn').focus();
  } else if (game.state === 'paused') {
    setState('playing');
    lastTime = 0;
    accumulator = 0;
    canvas.focus({ preventScroll: true });
  }
}

function toast(text) {
  const message = $('toast');
  message.textContent = text;
  message.classList.add('show');
  game.toastTime = 2.1;
}

function finish() {
  const distance = Math.floor(game.distance);
  const record = distance > game.best;
  saveBest();
  $('final-score').textContent = distance.toLocaleString();
  $('final-coins').textContent = game.coins;
  $('final-best').textContent = game.best.toLocaleString();
  $('new-best').hidden = !record;
  setState('over');
  $('again-btn').focus();
}

function crash() {
  setState('crashed');
  game.crashTime = .57;
  audio.effect('crash');
  if (!reduced) {
    $('flash').style.opacity = '.26';
    setTimeout(() => { $('flash').style.opacity = '0'; }, 75);
  }
}

function move(direction) {
  if (game.state === 'playing') game.lane = clamp(game.lane + direction, 0, 2);
}

function launchJump(velocity = CONFIG.jumpVelocity, sound = 'jump') {
  game.vy = velocity;
  game.grounded = false;
  game.rollTimer = 0;
  game.jumpBuffer = 0;
  audio.effect(sound);
}

function jump() {
  if (game.state !== 'playing') return;
  if (game.grounded) launchJump();
  else game.jumpBuffer = .12;
}

function roll() {
  if (game.state !== 'playing') return;
  if (!game.grounded) game.vy = -23;
  game.jumpBuffer = 0;
  game.rollTimer = CONFIG.rollDuration;
  audio.effect('roll');
}

function addCoin(lane, y, at) {
  coins.push({ x: laneX(lane), y, at });
}

function addObstacle(type, lane, at, phase) {
  const mesh = obstaclePool[type].pop() || prototypes[type].clone();
  scene.add(mesh);
  let marker;
  if (markerModels[type]) {
    marker = markerPools[type].pop() || markerModels[type].clone();
    scene.add(marker);
  }
  const z = obstacleZ(type, at, game.distance);
  obstacles.push({ ...OBSTACLES[type], type, lane, at, phase, mesh, marker, z, previousZ: z, x: obstacleX(type, lane, -z, phase) });
}

function recycle(obstacle) {
  scene.remove(obstacle.mesh);
  obstaclePool[obstacle.type].push(obstacle.mesh);
  if (obstacle.marker) {
    scene.remove(obstacle.marker);
    markerPools[obstacle.type].push(obstacle.marker);
  }
}

function placePuddings({ distance, lane, action, trail }) {
  if (trail) {
    for (const coin of trail) addCoin(coin.lane, coin.y, coin.distance);
  } else if (action === 'jump') {
    const spread = paceAt(distance) * .15;
    for (const index of [-1, 0, 1]) addCoin(lane, index === 0 ? 2.64 : 2.23, distance + index * spread);
  } else if (action === 'roll') {
    for (const offset of [-2.5, -.62, 1.26]) addCoin(lane, .57, distance + offset);
  } else {
    for (const offset of [-3, -.7, 1.6]) addCoin(lane, .91, distance + offset);
  }
}

function placeRoute(row) {
  for (const surface of row.surfaces ?? []) {
    const mesh = routeProps.surfaces[surface.type].clone();
    mesh.position.x = laneX(surface.lane);
    mesh.scale.z = (surface.end - surface.start) / SURFACE_MODEL_LENGTH;
    scene.add(mesh);
    surfaces.push({ ...surface, mesh });
  }
  for (const spring of row.springs ?? []) {
    const mesh = routeProps.spring.clone();
    mesh.position.x = laneX(spring.lane);
    scene.add(mesh);
    springs.push({ ...spring, mesh, usedAt: null });
  }
  for (const item of row.pickups ?? []) {
    const mesh = routeProps.pickups[item.type].clone();
    mesh.position.x = laneX(item.lane);
    scene.add(mesh);
    pickups.push({ ...item, mesh });
  }
}

function spawnAhead() {
  while (nextRow.distance <= game.distance + ahead) {
    for (const { type, lane, at, phase } of nextRow.obstacles) addObstacle(type, lane, at ?? nextRow.distance, phase);
    placeRoute(nextRow);
    placePuddings(nextRow);
    guideRows.push(nextRow);
    nextRow = course.next();
  }
}

function pruneProps(list, until) {
  while (list[0] && (list[0].end ?? list[0].distance) < until) scene.remove(list.shift().mesh);
}

function collectPickups(player) {
  for (let index = pickups.length - 1; index >= 0; index--) {
    const item = pickups[index];
    if (!reachesPickup(item, player)) continue;
    const power = PICKUPS[item.type];
    game[item.type] = power.duration;
    scene.remove(item.mesh);
    pickups.splice(index, 1);
    audio.effect('power');
    toast(item.type === 'shield' ? '布丁护盾 · 抵挡一次碰撞' : `${power.label} · ${power.duration} 秒`);
    if (!reduced) particles.burst(player.x, item.y, player.distance - item.distance);
  }
}

function step(dt) {
  const previousDistance = game.distance;
  game.speed = paceAt(previousDistance) * (game.sliding ? CONFIG.slideBoost : 1);
  game.distance += game.speed * dt;
  const targetX = game.x + (laneX(game.lane) - game.x) * damp(CONFIG.laneDamping, dt);
  game.rollTimer = Math.max(0, game.rollTimer - dt);
  game.jumpBuffer = Math.max(0, game.jumpBuffer - dt);
  game.magnet = Math.max(0, game.magnet - dt);
  game.double = Math.max(0, game.double - dt);
  game.grace = Math.max(0, game.grace - dt);
  const next = followSurface(surfaces, game, targetX, dt);
  if (next.sliding && !game.sliding) audio.effect('roll');
  game.x = next.x;
  game.y = next.y;
  game.vy = next.velocity;
  game.floor = next.floor;
  game.grounded = next.grounded;
  game.sliding = next.sliding;
  if (game.grounded && game.jumpBuffer) launchJump();
  for (const spring of springs) {
    if (spring.usedAt !== null || !hitsSpring(spring, game, previousDistance)) continue;
    spring.usedAt = game.distance;
    game.launches++;
    launchJump(CONFIG.springVelocity, 'spring');
  }

  const player = { x: game.x, y: game.y, distance: game.distance, rolling: game.sliding || game.rollTimer > 0 };
  collectPickups(player);
  for (const obstacle of obstacles) {
    obstacle.previousZ = obstacle.z;
    obstacle.z = obstacleZ(obstacle.type, obstacle.at, game.distance);
    obstacle.x = obstacleX(obstacle.type, obstacle.lane, -obstacle.z, obstacle.phase);
    if (obstacle.shielded || game.grace || !collision(obstacle, player)) continue;
    if (game.shield) {
      game.shield = 0;
      game.grace = .23;
      obstacle.shielded = true;
      audio.effect('power');
      if (!reduced) particles.burst(game.x, game.y + .95, 0);
      toast('护盾挡下了一次碰撞');
    } else {
      game.lastHit = obstacle.type;
      crash();
      return;
    }
  }
  const center = game.y + (player.rolling ? .45 : .98);
  for (let index = coins.length - 1; index >= 0; index--) {
    const coin = coins[index];
    const z = game.distance - coin.at;
    if (game.magnet && z > -4.7 && z < .75 && Math.abs(coin.x - game.x) < 3.45 && Math.abs(coin.y - center) < 3.3) {
      const pull = damp(19, dt);
      coin.x += (game.x - coin.x) * pull;
      coin.y += (center - coin.y) * pull;
    }
    if (z < -.73) continue;
    if (z < .75 && Math.abs(coin.x - game.x) < .67 && Math.abs(coin.y - center) < .70) {
      game.coins += game.double ? 2 : 1;
      audio.effect('coin');
      if (!reduced) particles.burst(coin.x, coin.y, z);
      coins.splice(index, 1);
    } else if (z > 9) {
      coins.splice(index, 1);
    }
  }
  while ((guideRows[0]?.end ?? guideRows[0]?.distance) < game.distance - 2) guideRows.shift();
  for (let index = obstacles.length - 1; index >= 0; index--) {
    const obstacle = obstacles[index];
    if (game.distance - obstacle.at < (obstacle.type === 'train' ? 24 : 13)) continue;
    recycle(obstacle);
    obstacles.splice(index, 1);
  }
  pruneProps(surfaces, game.distance - 12);
  pruneProps(springs, game.distance - 12);
  pruneProps(pickups, game.distance - 12);
  spawnAhead();

  const section = districtAt(game.distance);
  if (section !== district) changeDistrict(section);
  if (Math.floor(previousDistance / 500) < Math.floor(game.distance / 500)) toast(`跑过 ${Math.floor(game.distance / 500) * 500} 米啦！`);
}

function updateHint() {
  if (game.state !== 'playing') return;
  const row = guideRows.find(({ distance }) => distance > game.distance - .5);
  const event = guideRows.find(({ kind, distance, end }) => kind && distance - game.distance < 13 && end > game.distance);
  let hint = '';
  if (row && row.distance <= 46 && row.distance - game.distance < 17) {
    if (row.action === 'jump') hint = '↑ 跳过野餐篮';
    if (row.action === 'roll') hint = '↓ 滑过彩旗架';
    if (row.action === 'run') hint = '← 跟着布丁换到左道';
  }
  if (!hint && event) {
    const offset = game.distance - event.distance;
    if (event.kind === 'rail' && offset < 18) hint = '沿斜坡上车顶，留意迎面列车';
    if (event.kind === 'spring' && offset < 7) hint = '踩弹簧上高台';
    if (event.kind === 'roller' && offset < 15) hint = '糖球横穿两道 · 可跳过';
  }
  if (hint === visibleHint) return;
  visibleHint = hint;
  tutorial.textContent = hint;
  tutorial.hidden = !hint;
}

function animate(dt) {
  const menu = game.state === 'menu';
  const playing = game.state === 'playing';
  const portrait = camera.aspect < .82;
  const ended = game.state === 'crashed' || game.state === 'over';
  homeBlend += ((menu ? 1 : 0) - homeBlend) * damp(8, dt);
  const x = game.x * (1 - homeBlend) + (portrait ? 0 : 2.96) * homeBlend;
  const y = game.y * (1 - homeBlend);
  const z = homeBlend * (portrait ? 1.77 : 1.60);
  const scale = 1 + homeBlend * (portrait ? .22 : .75);
  const desiredX = game.x * .24 * (1 - homeBlend);
  const lift = (1 - homeBlend) * (game.floor * .74 + (game.y - game.floor) * .34);
  const desiredY = 4.96 + lift + homeBlend * (portrait ? 2.65 : .56);
  camera.position.x += (desiredX - camera.position.x) * damp(7, dt);
  camera.position.y += (desiredY - camera.position.y) * damp(7, dt);
  camera.position.z = 9.65 + homeBlend * (portrait ? 4.4 : 1.25);
  camera.lookAt(0, 1.60 + (camera.position.y - desiredY + lift) * .86 + homeBlend * (portrait ? 1.26 : .30), -7.8);
  const fov = (portrait ? 61 : 51) + (game.speed - CONFIG.startSpeed) * .085;
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  if (playing) game.phase += game.speed * dt * 1.62;
  let mode = 'run';
  if (menu) mode = 'menu';
  else if (ended) mode = 'crash';
  else if (game.sliding || game.rollTimer > 0) mode = 'slide';
  else if (!game.grounded) mode = 'jump';
  runner.draw(camera, { x, y, z, scale, mode, time, stride: game.phase, turn: (laneX(game.lane) - game.x) / CONFIG.laneWidth,
    crash: 1 - game.crashTime / .57, floor: game.floor, shield: game.shield || game.grace, reduced });
  track.update(game.distance);
  for (const obstacle of obstacles) {
    const rollingCandy = obstacle.type === 'roller';
    obstacle.mesh.position.set(obstacle.x, rollingCandy ? .72 : 0, obstacle.z);
    if (rollingCandy) obstacle.mesh.rotation.z = -(obstacle.x - laneX(obstacle.lane)) / .72;
    obstacle.mesh.visible = obstacle.z > -89 && obstacle.z < 10;
    if (obstacle.marker) {
      const markerZ = obstacle.type === 'shuttle' ? obstacle.z : game.distance - obstacle.at;
      obstacle.marker.position.set(laneX(obstacle.lane + (rollingCandy ? .5 : 0)), 0, markerZ);
      obstacle.marker.visible = markerZ > -89 && markerZ < 18;
    }
  }
  for (const surface of surfaces) surface.mesh.position.z = game.distance - (surface.start + surface.end) / 2;
  for (const spring of springs) {
    spring.mesh.position.z = game.distance - spring.distance;
    const rebound = spring.usedAt === null ? 0 : Math.exp(-(game.distance - spring.usedAt) / 2);
    spring.mesh.scale.y = 1 - .46 * rebound;
  }
  for (const item of pickups) {
    item.mesh.position.y = item.y + (reduced ? 0 : Math.sin(time * 3.8 + item.distance) * .13);
    item.mesh.position.z = game.distance - item.distance;
    item.mesh.rotation.y = reduced ? 0 : Math.sin(time * 2.4 + item.distance) * .68;
  }
  puddings.update(coins, game.distance, time, reduced);
  stage.tick(time, district.id, dt, reduced);
  return mode;
}

function updateHud() {
  const distance = Math.floor(game.distance);
  if (displayedDistance !== distance) {
    scoreHud.textContent = distance;
    displayedDistance = distance;
  }
  if (displayedCoins !== game.coins) {
    coinHud.textContent = game.coins;
    displayedCoins = game.coins;
  }
  const powers = Object.entries(PICKUPS)
    .filter(([type]) => game[type] > 0)
    .map(([type, { label }]) => type === 'shield' ? label : `${label} ${Math.ceil(game[type])}秒`)
    .join(' · ');
  if (powers !== displayedPowers) {
    displayedPowers = powers;
    powerHud.textContent = powers;
    powerHud.hidden = !powers;
  }
  updateHint();
}

function frame(now) {
  const dt = lastTime ? Math.min((now - lastTime) / 1000, .10) : 1 / 60;
  lastTime = now;
  const paused = game.state === 'paused';
  if (!paused) time += dt;
  if (game.state === 'playing') {
    accumulator += dt;
    while (accumulator >= CONFIG.step && game.state === 'playing') {
      step(CONFIG.step);
      accumulator -= CONFIG.step;
    }
  } else {
    accumulator = 0;
  }
  if (game.state === 'crashed') {
    game.crashTime = Math.max(0, game.crashTime - dt);
    if (game.crashTime === 0) finish();
  }
  if (game.toastTime > 0 && !paused) {
    game.toastTime -= dt;
    if (game.toastTime <= 0) $('toast').classList.remove('show');
  }
  particles.update(paused ? 0 : dt);
  const pose = animate(paused ? 0 : dt);
  audio.update(game.state === 'playing');
  updateHud();
  renderer.render(scene, camera);

  if (inspectRun) {
    metricTime += dt;
    metricFrames++;
    if (metricTime >= .20) {
      canvas.dataset.telemetry = JSON.stringify({
        state: game.state, distance: +game.distance.toFixed(2), lane: game.lane, y: +game.y.toFixed(2),
        speed: game.speed, rolling: game.sliding || game.rollTimer > 0, coins: game.coins, best: game.best, district: district.id,
        drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, tiles: track.size,
        fps: Math.round(metricFrames / metricTime),
        pose, floor: +game.floor.toFixed(2), sliding: game.sliding, launches: game.launches, lastHit: game.lastHit,
        powers: { shield: game.shield, magnet: game.magnet, double: game.double },
        rows: guideRows.slice(0, 5),
        vehicles: obstacles.filter(({ type }) => type === 'train' || type === 'roller').slice(0, 4)
          .map(({ type, lane, at, x, z }) => ({ type, lane, at, x, z })),
      });
      metricTime = 0;
      metricFrames = 0;
    }
  }
  requestAnimationFrame(frame);
}

function updateSound() {
  const button = $('sound-btn');
  button.classList.toggle('muted', audio.muted);
  button.setAttribute('aria-label', audio.muted ? '打开声音' : '关闭声音');
  button.setAttribute('aria-pressed', String(!audio.muted));
}

for (const id of ['play-btn', 'again-btn']) $(id).addEventListener('click', start);
for (const id of ['home-btn', 'pause-home-btn']) $(id).addEventListener('click', home);
for (const id of ['resume-btn', 'pause-btn']) $(id).addEventListener('click', togglePause);
$('sound-btn').addEventListener('click', () => { audio.toggle(); updateSound(); });
for (const [button, dialog] of [['help-btn', 'help-dialog'], ['credits-btn', 'credits-dialog']]) {
  $(button).addEventListener('click', () => $(dialog).showModal());
}
for (const button of document.querySelectorAll('.close-dialog')) button.addEventListener('click', () => button.closest('dialog').close());
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const { left, right, top, bottom } = dialog.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dialog.close();
  });
}

window.addEventListener('keydown', (event) => {
  if (document.querySelector('dialog[open]')) return;
  const key = event.code;
  if ((key === 'Space' || key === 'Enter') && event.target instanceof Element && event.target.closest('button,a,input,select,textarea')) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(key)) event.preventDefault();
  if (event.repeat) return;
  if (key === 'KeyP' || key === 'Escape') {
    togglePause();
  } else if ((key === 'Space' || key === 'Enter') && (game.state === 'menu' || game.state === 'over')) {
    start();
  } else if (key === 'Space' && game.state === 'paused') {
    togglePause();
  } else if (key === 'ArrowLeft' || key === 'KeyA') {
    move(-1);
  } else if (key === 'ArrowRight' || key === 'KeyD') {
    move(1);
  } else if (key === 'ArrowUp' || key === 'KeyW' || key === 'Space') {
    jump();
  } else if (key === 'ArrowDown' || key === 'KeyS') {
    roll();
  }
});

canvas.addEventListener('pointerdown', (event) => {
  if (game.state !== 'playing' || gesture || !event.isPrimary) return;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!gesture || gesture.id !== event.pointerId || game.state !== 'playing') return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 23) return;
  gesture = null;
  if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx));
  else if (dy < 0) jump();
  else roll();
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(name, (event) => { if (gesture?.id === event.pointerId) gesture = null; });
}
window.addEventListener('pagehide', saveBest);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') togglePause();
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  if (game.state === 'playing') togglePause();
  toast('画面暂时休息了，请刷新后再试');
});

canvas.tabIndex = -1;
reset();
setState('menu');
updateBest();
updateSound();
$('loading').remove();
requestAnimationFrame(frame);
