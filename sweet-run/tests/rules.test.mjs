import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, collision, createCourse, damp, DECK_HEIGHT, districtAt, followSurface, hitsSpring, isDistrictEntrance,
  laneX, loadRecord, OBSTACLES, obstacleX, obstacleZ, paceAt, PICKUPS, reachesPickup } from '../src/rules.mjs';

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function rowsThrough(seed, limit) {
  const course = createCourse(seeded(seed));
  const rows = [];
  for (let row = course.next(); row.distance <= limit; row = course.next()) rows.push(row);
  return rows;
}

test('the opening introduces jump, slide and change of lane within five seconds', () => {
  const opening = rowsThrough(1, 125);
  assert.deepEqual(opening.slice(0, 3).map(({ action }) => action), ['jump', 'roll', 'run']);
  assert.equal(opening[0].distance, 18);
  assert(opening[2].distance / CONFIG.startSpeed < 5);
  assert.equal(opening[3].kind, 'rail');
  assert.equal(opening[4].kind, 'spring');
});

test('five districts repeat on tile boundaries and all their obstacle types can appear', () => {
  const boundaries = [0, 96, 224, 352, 480, 608, 704];
  const districts = ['town', 'grove', 'river', 'market', 'workshop', 'town', 'grove'];
  for (const [index, distance] of boundaries.entries()) {
    assert.equal(districtAt(distance).id, districts[index]);
    assert.equal(isDistrictEntrance(distance / 32), distance > 0);
    if (distance > 0) assert.equal(districtAt(distance - .001).id, districts[index - 1]);
  }
  const types = new Set([1, 4, 6, 10, 20261125].flatMap((seed) =>
    rowsThrough(seed, 2000).flatMap((row) => row.obstacles.map(({ type }) => type))));
  assert.deepEqual([...types].sort(), Object.keys(OBSTACLES).sort());
});

test('challenge rows stay dense, require actions and tighten as the player speeds up', () => {
  const rows = [1, 4, 6, 10, 14].flatMap((seed) => rowsThrough(seed, 1800));
  const intervals = rows.slice(1).flatMap((row, i) => {
    const previous = rows[i];
    if (row.kind || previous.kind || previous.distance >= row.distance) return [];
    return [[row.distance, (row.distance - previous.distance) / paceAt(row.distance)]];
  });
  const early = intervals.filter(([at]) => at > 160 && at < 320).map(([, secs]) => secs);
  const late = intervals.filter(([at]) => at > 600).map(([, secs]) => secs);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert(mean(late) < mean(early) - .06);
  const ordinaryRows = rows.filter(({ kind }) => !kind);
  assert(ordinaryRows.filter(({ obstacles }) => obstacles.length === 3).length > ordinaryRows.length / 3);
  for (const row of ordinaryRows) assert.equal(new Set(row.obstacles.map(({ lane }) => lane)).size, row.obstacles.length);
});

test('continuous routes clear both movement encounters and dense rows across many seeds', () => {
  const limit = 1380;
  for (let seed = 1; seed <= 36; seed++) {
    const rows = rowsThrough(seed, limit + 140);
    const surfaces = rows.flatMap((row) => row.surfaces ?? []);
    const springs = rows.flatMap((row) => row.springs ?? []);
    const obstacles = rows.flatMap((row) => row.obstacles.map((obstacle) => ({ ...obstacle, at: obstacle.at ?? row.distance })));
    for (const delay of [-.065, 0, .065]) {
      let distance = 0, x = 0, y = 0, vy = 0, grounded = true, rollTimer = 0, lane = 1;
      let upcoming = 0, firstRelevant = 0, lastRow = 0;
      let sliding = false, rampRuns = 0, lastSlide = false;
      const triggered = new Set();
      while (distance < limit) {
        const speed = paceAt(distance) * (sliding ? CONFIG.slideBoost : 1);
        const row = rows[upcoming];
        if (distance > lastRow + 1.65) lane = row.lane;
        const lead = (row.action === 'jump' ? .367 : row.action === 'roll' ? .245 : .14) - delay;
        if (distance >= row.distance - lead * speed) {
          if (row.action === 'jump') {
            assert(grounded, `seed ${seed}: jump was not grounded at ${distance.toFixed(2)}`);
            vy = CONFIG.jumpVelocity;
            grounded = false;
            rollTimer = 0;
          }
          if (row.action === 'roll') {
            if (!grounded) vy = -23;
            rollTimer = CONFIG.rollDuration;
          }
          lastRow = row.end ?? row.distance;
          upcoming++;
        }
        const previousDistance = distance;
        distance += speed * CONFIG.step;
        const targetX = x + (laneX(lane) - x) * damp(CONFIG.laneDamping, CONFIG.step);
        ({ x, y, velocity: vy, grounded, sliding } = followSurface(surfaces, { distance, x, y, vy, grounded }, targetX, CONFIG.step));
        if (sliding && !lastSlide) rampRuns++;
        lastSlide = sliding;
        for (const spring of springs) {
          if (triggered.has(spring) || !hitsSpring(spring, { distance, x, y, grounded }, previousDistance)) continue;
          triggered.add(spring);
          vy = CONFIG.springVelocity;
          grounded = false;
          rollTimer = 0;
        }
        rollTimer = Math.max(0, rollTimer - CONFIG.step);
        while (obstacles[firstRelevant]?.at < distance - 7) firstRelevant++;
        for (let index = firstRelevant; obstacles[index]?.at < distance + 7; index++) {
          const { type, lane: column, at, phase } = obstacles[index];
          const z = obstacleZ(type, at, distance);
          const overlaps = collision({ ...OBSTACLES[type], x: obstacleX(type, column, -z, phase), z,
            previousZ: obstacleZ(type, at, previousDistance) }, { x, y, rolling: sliding || rollTimer > 0 });
          assert(!overlaps, `seed ${seed}, delay ${delay}, obstacle ${type} at ${at.toFixed(2)}, player at ${distance.toFixed(2)}`);
        }
      }
      assert(springs.every((spring) => spring.distance >= limit - 1 || triggered.has(spring)));
      assert(rampRuns >= rows.filter(({ kind, end }) => (kind === 'rail' || kind === 'spring') && end < limit).length);
    }
  }
});

test('a fast collision cannot skip a barrier, and rolling clears the low span', () => {
  const position = { x: 0, previousZ: -2, z: 2 };
  assert(collision({ ...OBSTACLES.basket, ...position }, { x: 0, y: 0 }));
  assert(!collision({ ...OBSTACLES.basket, ...position }, { x: 0, y: 1.2 }));
  assert(!collision({ ...OBSTACLES.basket, ...position }, { x: laneX(0), y: 0 }));
  assert(collision({ ...OBSTACLES.beam, ...position }, { x: 0, y: 0 }));
  assert(!collision({ ...OBSTACLES.beam, ...position }, { x: 0, y: 0, rolling: true }));
  assert(collision({ ...OBSTACLES.gap, ...position }, { x: 0, y: 0, rolling: true }));
});

test('moving carts settle into the marked lane before the collision zone', () => {
  for (const lane of [0, 1, 2]) {
    assert.notEqual(obstacleX('shuttle', lane, 30), laneX(lane));
    assert.equal(obstacleX('shuttle', lane, 14), laneX(lane));
    assert.equal(obstacleX('shuttle', lane, 0), laneX(lane));
  }
});

test('trains approach in world space while rolling candy sweeps across live lanes', () => {
  assert(obstacleZ('train', 100, 40) < obstacleZ('cart', 100, 40));
  assert(obstacleZ('train', 100, 102) > obstacleZ('cart', 100, 102));
  assert.equal(obstacleZ('train', 100, 100), 0);
  assert.notEqual(obstacleX('roller', 0, 2), obstacleX('roller', 0, -2));
  const ball = { ...OBSTACLES.roller, x: obstacleX('roller', 0, 0), z: 0, previousZ: -.2 };
  assert(collision(ball, { x: ball.x, y: 0 }));
  assert(!collision(ball, { x: ball.x, y: 1.6 }));
  assert(!collision(ball, { x: laneX(2), y: 0 }));
});

test('a parked wagon has a solid side and a canopy can be passed underneath', () => {
  const player = { distance: 12, x: laneX(1), grounded: true, y: 0, vy: 0 };
  const wagon = { type: 'wagon', lane: 0, start: 4, end: 20, solid: true };
  assert.equal(followSurface([wagon], player, laneX(0), CONFIG.step).x, laneX(1));
  const canopy = { ...wagon, type: 'canopy', solid: false };
  const under = followSurface([canopy], player, laneX(0), CONFIG.step);
  assert.equal(under.x, laneX(0));
  assert.equal(under.floor, 0);
  const landing = followSurface([canopy], { ...player, grounded: false, y: DECK_HEIGHT + .04, vy: -10 }, laneX(0), CONFIG.step);
  assert.equal(landing.y, DECK_HEIGHT);
  assert(landing.grounded);
  const offEdge = followSurface([wagon], { ...player, y: DECK_HEIGHT }, laneX(1), CONFIG.step);
  assert(!offEdge.grounded);
  assert(offEdge.y < DECK_HEIGHT && offEdge.y > 2);
});

test('pickup types and heights vary with the run, and altitude is checked when collecting', () => {
  const dropsBySeed = [1, 25, 430, 1234].map((seed) => rowsThrough(seed, 850).flatMap((row) => row.pickups ?? []));
  assert.equal(new Set(dropsBySeed.map((drops) => JSON.stringify(drops))).size, 4);
  assert.deepEqual(new Set(dropsBySeed.flat().map(({ type }) => type)), new Set(Object.keys(PICKUPS)));
  const high = dropsBySeed[0].find(({ y }) => y > 3);
  const player = { x: laneX(high.lane), distance: high.distance, y: 0 };
  assert(!reachesPickup(high, player));
  assert(reachesPickup(high, { ...player, y: DECK_HEIGHT }));
  assert(!reachesPickup(high, { ...player, y: DECK_HEIGHT, distance: high.distance + 2 }));
});
test('the previous best survives the update and unavailable storage falls back to zero', () => {
  for (const input of ['NaN', 'Infinity', '-10', 'bad', null]) assert.equal(loadRecord({ getItem: () => input }), 0);
  assert.equal(loadRecord(null), 0);
  assert.equal(loadRecord({ getItem() { throw new Error('blocked'); } }), 0);
  assert.equal(loadRecord({ getItem: (key) => key === 'rilakkumaSweetRun.best' ? 123 : null }), 123);
});
