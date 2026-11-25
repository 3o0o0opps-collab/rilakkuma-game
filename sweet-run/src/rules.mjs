// Three-lane movement and swept collisions adapted from Subway Rush (MIT).
export const CONFIG = Object.freeze({
  laneWidth: 2.4,
  startSpeed: 13.4,
  maxSpeed: 29,
  gravity: 29,
  jumpVelocity: 11.5,
  springVelocity: 16.8,
  rollDuration: .72,
  slideBoost: 1.15,
  laneDamping: 21,
  step: 1 / 120,
});

export const TILE_LENGTH = 32;
export const DISTRICTS = Object.freeze([
  { id: 'town', label: '甜品小镇', start: 0,    jump: 'basket', roll: 'bunting', blocks: ['cart'], events: ['rail', 'roller'] },
  { id: 'grove', label: '樱花野餐道', start: 96,  jump: 'log',    roll: 'branch',  blocks: ['hedge', 'cart'], events: ['spring', 'roller'] },
  { id: 'river', label: '蜂蜜河畔', start: 224, jump: 'gap',    roll: 'beam',    blocks: ['hives', 'shuttle'], events: ['rail', 'spring'] },
  { id: 'market', label: '灯笼夜市', start: 352, jump: 'sweets', roll: 'lanterns',blocks: ['shuttle', 'cart'], events: ['roller', 'rail'] },
  { id: 'workshop', label: '布丁工坊', start: 480, jump: 'sweets', roll: 'beam', blocks: ['hives', 'cart'], events: ['roller', 'spring'] },
]);
export const DISTRICT_LOOP = 608;

export const DECK_HEIGHT = 2.65;
export const TRAIN_LENGTH = 11.6;
export const PICKUPS = Object.freeze({
  shield: { label: '布丁护盾', color: '#b27187', duration: 1 },
  magnet: { label: '布丁磁铁', color: '#489684', duration: 7 },
  double: { label: '双倍布丁', color: '#b47925', duration: 8 },
});
const pickupTypes = Object.keys(PICKUPS);

const jumpBox = (halfDepth, top) => ({ action: 'jump', halfWidth: .99, halfDepth, bottom: 0, top });
const rollBox = (halfDepth, bottom) => ({ action: 'roll', halfWidth: 1.00, halfDepth, bottom, top: 2.6 });
const fullBox = (halfDepth) => ({ action: 'dodge', halfWidth: .98, halfDepth, bottom: 0, top: 4.8 });
export const OBSTACLES = Object.freeze({
  basket:   { ...jumpBox(.43, .98), label: '野餐篮' },
  bunting:  { ...rollBox(.29, 1.25), label: '彩旗架' },
  cart:     { ...fullBox(.97), label: '点心车' },
  log:      { ...jumpBox(.49, 1.00), label: '樱花横木' },
  branch:   { ...rollBox(.42, 1.25), label: '低垂的花枝' },
  hedge:    { ...fullBox(.68), label: '花篱' },
  gap:      { ...jumpBox(1.23, .60), label: '断桥' },
  beam:     { ...rollBox(.45, 1.24), label: '桥上横梁' },
  hives:    { ...fullBox(.74), label: '蜂蜜桶堆' },
  shuttle:  { ...fullBox(.88), label: '横移甜品车' },
  sweets:   { ...jumpBox(.50, 1.14), label: '点心箱' },
  lanterns: { ...rollBox(.38, 1.22), label: '灯笼帘' },
  train:    { ...fullBox(TRAIN_LENGTH / 2), halfWidth: 1.02, top: 3.25, label: '蜂蜜列车' },
  roller:   { ...jumpBox(.72, 1.42), halfWidth: .72, label: '旋转糖球' },
});

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
export const laneX = (lane) => (lane - 1) * CONFIG.laneWidth;
export const paceAt = (distance) => CONFIG.maxSpeed - (CONFIG.maxSpeed - CONFIG.startSpeed) * Math.exp(-distance / 345);
const smoothstep = (value) => value * value * (3 - 2 * value);

export function districtAt(distance) {
  const inLoop = Math.max(0, distance) % DISTRICT_LOOP;
  for (let index = DISTRICTS.length - 1; index > 0; index--) {
    if (inLoop >= DISTRICTS[index].start) return DISTRICTS[index];
  }
  return DISTRICTS[0];
}

export function isDistrictEntrance(tileIndex) {
  if (tileIndex <= 0) return false;
  const inLoop = (tileIndex * TILE_LENGTH) % DISTRICT_LOOP;
  return DISTRICTS.some(({ start }) => start === inLoop);
}

const OPENING = [
  { distance: 18, lane: 1, action: 'jump', obstacles: [{ lane: 1, type: 'basket' }] },
  { distance: 32, lane: 1, action: 'roll', obstacles: [{ lane: 1, type: 'bunting' }] },
  { distance: 46, lane: 0, action: 'run',  obstacles: [{ lane: 1, type: 'cart' }, { lane: 2, type: 'basket' }] },
];

const PHRASES = [
  { from: 0,   moves: ['run', 'run', 'run'] },
  { from: 0,   moves: ['run', 'jump', 'run', 'roll'] },
  { from: 105, moves: ['jump', 'roll', 'run'] },
  { from: 145, moves: ['roll', 'run', 'jump', 'run'] },
  { from: 210, moves: ['run', 'roll', 'jump', 'run'] },
  { from: 250, moves: ['jump', 'run', 'run', 'roll', 'jump'] },
];

function pick(items, random) {
  return items[Math.floor(random() * items.length)];
}

function nextLane(previous, beforePrevious, random) {
  if (previous !== 1) return 1;
  if (beforePrevious === 0) return 2;
  if (beforePrevious === 2) return 0;
  return random() < .5 ? 0 : 2;
}

// Preserve roughly the same reading time as speed climbs, then tighten it.
// Back-to-back jumps and rolls need an extra beat for the jump to land.
function nextDistance(previous, action, firstInPhrase, random) {
  const pressure = clamp((previous.distance - 60) / 380, 0, 1);
  let seconds = .87 - .31 * pressure + .16 * random();
  if (firstInPhrase) seconds += .12;
  if (previous.action !== 'run' && action !== 'run') seconds = Math.max(.98, seconds);
  const upperPace = paceAt(previous.distance + seconds * CONFIG.maxSpeed);
  return previous.distance + upperPace * seconds;
}

function gift(lane, distance, y, random) {
  return { lane, distance, y, type: pick(pickupTypes, random) };
}

function deckTrail(surfaces) {
  return surfaces.flatMap((surface) => {
    const coins = [];
    for (let at = surface.start + 1.7; at < surface.end - .8; at += 3) {
      coins.push({ lane: surface.lane, distance: at, y: surfaceHeight(surface, at) + (surface.type === 'slide' ? .49 : .96) });
    }
    return coins;
  });
}

function railEncounter(distance, lane, random, first) {
  const roof = first ? 0 : lane;
  const trainLane = first ? 1 : pick([0, 1, 2].filter((column) => column !== roof), random);
  const ground = 3 - roof - trainLane;
  const surfaces = [
    { type: 'ramp', lane: roof, start: distance + 4, end: distance + 12, solid: true },
    { type: 'wagon', lane: roof, start: distance + 12, end: distance + 28, solid: true },
    { type: 'slide', lane: roof, start: distance + 28, end: distance + 39, solid: true },
  ];
  const obstacles = [{ type: 'train', lane: trainLane, at: distance + 19 }];
  if (distance > 275 && random() < .56) obstacles.push({ type: 'train', lane: ground, at: distance + 36 });
  const trail = [...deckTrail(surfaces), ...[10, 17, 26].map((offset) => ({ lane: ground, distance: distance + offset, y: .91 }))];
  const railDrop = { lane: roof, distance: distance + 19 + random() * 6, y: DECK_HEIGHT + 1 };
  const groundDrop = { lane: ground, distance: distance + 23 + random() * 5, y: .96 };
  const drop = first || random() < .72 ? railDrop : groundDrop;
  return {
    kind: 'rail', distance, end: distance + 46, lane: roof, action: 'run', obstacles, surfaces, trail,
    pickups: [gift(drop.lane, drop.distance, drop.y, random)],
  };
}

function springEncounter(distance, lane, random) {
  const launcherLane = pick([0, 1, 2].filter((column) => Math.abs(column - lane) <= 1), random);
  const springAt = distance + 4.5;
  const pace = paceAt(springAt);
  const landing = springAt + pace * 1.01;
  const surfaces = [
    { type: 'canopy', lane: launcherLane, start: springAt + pace * .65, end: landing + 9 },
    { type: 'slide', lane: launcherLane, start: landing + 9, end: landing + 20 },
  ];
  const groundLane = launcherLane === 1 ? 2 : 1;
  const lowerObstacle = { type: districtAt(landing).jump, lane: launcherLane, at: landing + 4.2 };
  const trail = [
    { lane: launcherLane, distance: springAt - 2.2, y: .92 },
    ...[.20, .37, .55, .73, .90].map((seconds) => ({
      lane: launcherLane,
      distance: springAt + pace * seconds,
      y: .98 + CONFIG.springVelocity * seconds - CONFIG.gravity * seconds ** 2 / 2,
    })),
    ...deckTrail(surfaces),
    ...[7, 15, 23].map((offset) => ({ lane: groundLane, distance: distance + offset, y: .91 })),
  ];
  const elevated = random() < .74;
  return {
    kind: 'spring', distance, end: landing + 25, lane: launcherLane, action: 'run', obstacles: [lowerObstacle],
    springs: [{ lane: launcherLane, distance: springAt }], surfaces, trail,
    pickups: [gift(elevated ? launcherLane : groundLane, landing + 3.5 + random() * 3, elevated ? DECK_HEIGHT + .96 : .96, random)],
  };
}

function rollerEncounter(distance, lane, random) {
  const left = lane === 0 ? 1 : lane === 2 ? 0 : pick([0, 1], random);
  const safe = left === 0 ? 2 : 0;
  const rollers = [12, 26].map((offset) => ({ type: 'roller', lane: left, at: distance + offset, phase: random() * 2 * Math.PI }));
  const risky = random() < .65;
  return {
    kind: 'roller', distance, end: distance + 32, lane: safe, action: 'run', obstacles: rollers,
    trail: [6, 14, 22, 29].map((offset) => ({ lane: safe, distance: distance + offset, y: .91 })),
    pickups: random() < .53 ? [gift(risky ? left + pick([0, 1], random) : safe, distance + 16.5 + random() * 3.5, .96, random)] : [],
  };
}

const encounterMakers = { rail: railEncounter, spring: springEncounter, roller: rollerEncounter };

/** Ordinary rows link encounters with a continuous route. */
export function createCourse(random = Math.random) {
  let openingIndex = 0, phraseIndex = 0, phrase = null, previous = null, beforePrevious = 1;
  let nextEncounter = 55, lastEncounter, encounterCount = 0, nextGift = 145;
  return {
    next() {
      if (openingIndex < OPENING.length) {
        let row = OPENING[openingIndex++];
        if (openingIndex === OPENING.length) row = { ...row, pickups: [gift(0, 42 + random() * 2, .96, random)] };
        beforePrevious = previous?.lane ?? 1;
        previous = row;
        return row;
      }

      const firstInPhrase = !phrase || phraseIndex >= phrase.moves.length;
      if (firstInPhrase) {
        phrase = pick(PHRASES.filter((candidate) => candidate !== phrase && candidate.from <= previous.distance), random);
        phraseIndex = 0;
      }
      const action = phrase.moves[phraseIndex++];
      const distance = nextDistance(previous, action, firstInPhrase, random);
      const district = districtAt(distance);
      if (distance >= nextEncounter) {
        const start = Math.max(nextEncounter, previous.distance + paceAt(previous.distance) * .54);
        const kinds = districtAt(start).events.filter((kind) => kind !== lastEncounter);
        const kind = encounterCount === 0 ? 'rail' : encounterCount === 1 ? 'spring' : pick(kinds, random);
        const row = encounterMakers[kind](start, previous.lane, random, encounterCount === 0);
        encounterCount++;
        lastEncounter = kind;
        nextEncounter = row.end + (encounterCount === 1 ? 14 : paceAt(row.end) * (1.37 + random() * 1.42));
        beforePrevious = previous.lane;
        previous = { distance: row.end, lane: row.lane, action: 'run' };
        phrase = null;
        return row;
      }
      // A turning row only asks for one lane of movement. Action rows can
      // change lanes after a run but stay put after a jump or roll.
      const turning = action === 'run' || (previous.action === 'run' && random() < .34);
      const lane = turning ? nextLane(previous.lane, beforePrevious, random) : previous.lane;
      const mayTakeAlternate = action !== 'run' && distance > 148 && random() < .26;
      const alternate = lane === 1 ? beforePrevious === 0 ? 2 : 0 : 1;
      const obstacles = [];
      for (let column = 0; column < 3; column++) {
        let type;
        if (column === lane) {
          if (action !== 'run') type = district[action];
        } else if (mayTakeAlternate && column === alternate) {
          type = district[action === 'jump' ? 'roll' : 'jump'];
        } else if (action === 'run' && random() < .31) {
          type = random() < .56 ? district.jump : district.roll;
        } else {
          type = pick(district.blocks, random);
        }
        if (type) obstacles.push({ lane: column, type });
      }
      // A shuttle crosses into its marked lane while far away. Keep each
      // row readable by showing a single moving vehicle at most.
      const shuttles = obstacles.filter(({ type }) => type === 'shuttle');
      for (const extra of shuttles.slice(1)) extra.type = district.id === 'river' ? 'hives' : 'cart';
      const row = { distance, lane, action, obstacles };
      if (action === 'run' && distance >= nextGift) {
        row.pickups = [gift(lane, distance - 1.5, .96, random)];
        nextGift = distance + 39 + random() * 55;
      }
      beforePrevious = previous.lane;
      previous = row;
      return row;
    },
  };
}

export function obstacleZ(type, at, distance) {
  return (distance - at) * (type === 'train' ? 1.68 : 1);
}

export function obstacleX(type, lane, remaining, phase = 0) {
  const x = laneX(lane);
  if (type === 'roller') return x + CONFIG.laneWidth * (.5 + .5 * Math.sin(remaining * .32 + phase));
  if (type !== 'shuttle') return x;
  const offset = clamp((remaining - 14) / 16, 0, 1);
  const side = lane === 1 ? -1 : Math.sign(x);
  return x + smoothstep(offset) * side * CONFIG.laneWidth;
}

export function surfaceHeight(surface, distance) {
  const progress = clamp((distance - surface.start) / (surface.end - surface.start), 0, 1);
  if (surface.type === 'ramp') return DECK_HEIGHT * smoothstep(progress);
  if (surface.type === 'slide') return DECK_HEIGHT * (1 - smoothstep(progress));
  return DECK_HEIGHT;
}

function surfaceBelow(surfaces, distance, x) {
  return surfaces.find(({ lane, start, end }) =>
    distance >= start && distance <= end && Math.abs(x - laneX(lane)) < 1.10);
}

export function verticalStep(y, velocity, grounded, dt, floor = 0) {
  if (grounded && floor >= y - .19 && floor <= y + .22) return { y: floor, velocity: 0, grounded: true };
  velocity -= CONFIG.gravity * dt;
  const nextY = y + velocity * dt;
  if (nextY <= floor && y >= floor - .16 && velocity <= 0) return { y: floor, velocity: 0, grounded: true };
  if (nextY <= 0) return { y: 0, velocity: 0, grounded: true };
  return { y: nextY, velocity, grounded: false };
}

export function followSurface(surfaces, player, targetX, dt) {
  const { distance, y, vy, grounded } = player;
  const target = surfaceBelow(surfaces, distance, targetX);
  const sideWall = target?.solid && surfaceHeight(target, distance) > y + .29;
  const x = sideWall ? player.x : targetX;
  const surface = sideWall ? surfaceBelow(surfaces, distance, x) : target;
  const surfaceY = surface ? surfaceHeight(surface, distance) : 0;
  const floor = surfaceY <= y + .20 ? surfaceY : 0;
  const step = verticalStep(y, vy, grounded, dt, floor);
  return { ...step, x, floor, sliding: step.grounded && surface?.type === 'slide' && floor > .035 };
}

export function hitsSpring(spring, player, previousDistance) {
  return player.grounded && player.y < .22 && Math.abs(laneX(spring.lane) - player.x) < .83 &&
    player.distance >= spring.distance - .28 && previousDistance <= spring.distance + .55;
}

export function reachesPickup(item, player) {
  const center = player.y + (player.rolling ? .46 : .98);
  const z = player.distance - item.distance;
  return z >= -.72 && z <= .78 && Math.abs(laneX(item.lane) - player.x) < .72 && Math.abs(item.y - center) < .82;
}

export function collision(obstacle, player) {
  const height = player.rolling ? .78 : 1.92;
  return Math.abs(player.x - obstacle.x) < obstacle.halfWidth + .31 &&
    player.y < obstacle.top && player.y + height > obstacle.bottom &&
    Math.max(obstacle.previousZ, obstacle.z) + obstacle.halfDepth > -.27 &&
    Math.min(obstacle.previousZ, obstacle.z) - obstacle.halfDepth < .27;
}

export function loadRecord(storage) {
  try {
    const value = Number(storage.getItem('rilakkumaSweetRun.best'));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}
