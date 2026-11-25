// Three-lane movement and swept collisions adapted from Subway Rush (MIT).
export const CONFIG = Object.freeze({
  laneWidth: 2.4,
  startSpeed: 13.4,
  maxSpeed: 29,
  gravity: 29,
  jumpVelocity: 11.5,
  rollDuration: .72,
  laneDamping: 21,
  step: 1 / 120,
});

export const TILE_LENGTH = 32;
export const DISTRICTS = Object.freeze([
  { id: 'town', label: '甜品小镇', start: 0,    jump: 'basket', roll: 'bunting', blocks: ['cart'] },
  { id: 'grove', label: '樱花野餐道', start: 96,  jump: 'log',    roll: 'branch',  blocks: ['hedge', 'cart'] },
  { id: 'river', label: '蜂蜜河畔', start: 224, jump: 'gap',    roll: 'beam',    blocks: ['hives', 'shuttle'] },
  { id: 'market', label: '灯笼夜市', start: 352, jump: 'sweets', roll: 'lanterns',blocks: ['shuttle', 'cart'] },
]);
export const DISTRICT_LOOP = 480;

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
});

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
export const laneX = (lane) => (lane - 1) * CONFIG.laneWidth;
export const paceAt = (distance) => CONFIG.maxSpeed - (CONFIG.maxSpeed - CONFIG.startSpeed) * Math.exp(-distance / 345);

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
  { distance: 47, lane: 0, action: 'run',  obstacles: [{ lane: 1, type: 'cart' }, { lane: 2, type: 'basket' }] },
  { distance: 63, lane: 0, action: 'jump', obstacles: [{ lane: 0, type: 'basket' }, { lane: 1, type: 'cart' }, { lane: 2, type: 'cart' }] },
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

/** Each phrase has a continuous route, sometimes requiring a jump or roll. */
export function createCourse(random = Math.random) {
  let openingIndex = 0, phraseIndex = 0, phrase = null, previous = null, beforePrevious = 1;
  return {
    next() {
      if (openingIndex < OPENING.length) {
        const row = OPENING[openingIndex++];
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
      beforePrevious = previous.lane;
      previous = row;
      return row;
    },
  };
}

export function obstacleX(type, lane, remaining) {
  const x = laneX(lane);
  if (type !== 'shuttle') return x;
  const offset = clamp((remaining - 14) / 16, 0, 1);
  const smooth = offset * offset * (3 - 2 * offset);
  const side = lane === 1 ? -1 : Math.sign(x);
  return x + smooth * side * CONFIG.laneWidth;
}

export function verticalStep(y, velocity, grounded, dt) {
  if (grounded) return { y: 0, velocity: 0, grounded: true };
  velocity -= CONFIG.gravity * dt;
  y += velocity * dt;
  if (y <= 0) return { y: 0, velocity: 0, grounded: true };
  return { y, velocity, grounded: false };
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
