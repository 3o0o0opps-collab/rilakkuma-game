import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, collision, createCourse, damp, districtAt, isDistrictEntrance, laneX, loadRecord, OBSTACLES, obstacleX, paceAt, verticalStep } from '../src/rules.mjs';

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
  const opening = rowsThrough(1, 64);
  assert.deepEqual(opening.map(({ action }) => action), ['jump', 'roll', 'run', 'jump']);
  assert.equal(opening[0].distance, 18);
  assert(opening.at(-1).distance / CONFIG.startSpeed < 5);
  assert.equal(opening.at(-1).obstacles.length, 3);
});

test('the four districts repeat on tile boundaries and their obstacle sets all occur', () => {
  const boundaries = [0, 96, 224, 352, 480, 576];
  const districts = ['town', 'grove', 'river', 'market', 'town', 'grove'];
  for (const [index, distance] of boundaries.entries()) {
    assert.equal(districtAt(distance).id, districts[index]);
    assert.equal(isDistrictEntrance(distance / 32), distance > 0);
    if (distance > 0) assert.equal(districtAt(distance - .001).id, districts[index - 1]);
  }
  const types = new Set(rowsThrough(20261125, 1100).flatMap((row) => row.obstacles.map(({ type }) => type)));
  assert.deepEqual([...types].sort(), Object.keys(OBSTACLES).sort());
});

test('challenge rows stay dense, require actions and tighten as the player speeds up', () => {
  const rows = rowsThrough(2, 1500);
  const early = rows.filter(({ distance }) => distance > 60 && distance < 160);
  const late = rows.filter(({ distance }) => distance > 600);
  const intervals = (group) => group.slice(1).map((row, i) => (row.distance - group[i].distance) / paceAt(row.distance));
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert(mean(intervals(late)) < mean(intervals(early)) - .15);
  assert(rows.filter(({ obstacles }) => obstacles.length === 3).length > rows.length / 3);
  for (const row of rows) assert.equal(new Set(row.obstacles.map(({ lane }) => lane)).size, row.obstacles.length);
});

test('continuous routes clear forced jumps, slides, lane changes and moving carts across many seeds', () => {
  const limit = 1380;
  for (let seed = 1; seed <= 36; seed++) {
    const rows = rowsThrough(seed, limit + 40);
    for (const delay of [-.065, 0, .065]) {
      let distance = 0, x = 0, y = 0, vy = 0, grounded = true, rollTimer = 0, lane = 1;
      let upcoming = 0, firstRelevant = 0, lastRow = 0;
      while (distance < limit) {
        const speed = paceAt(distance);
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
          lastRow = row.distance;
          upcoming++;
        }
        const previousDistance = distance;
        distance += speed * CONFIG.step;
        x += (laneX(lane) - x) * damp(CONFIG.laneDamping, CONFIG.step);
        ({ y, velocity: vy, grounded } = verticalStep(y, vy, grounded, CONFIG.step));
        rollTimer = Math.max(0, rollTimer - CONFIG.step);
        while (rows[firstRelevant].distance < distance - 2.5) firstRelevant++;
        for (let index = firstRelevant; rows[index].distance < distance + 2.5; index++) {
          const active = rows[index];
          const z = distance - active.distance;
          for (const obstacle of active.obstacles) {
            const overlaps = collision({ ...OBSTACLES[obstacle.type], x: obstacleX(obstacle.type, obstacle.lane, -z), z,
              previousZ: previousDistance - active.distance }, { x, y, rolling: rollTimer > 0 });
            assert(!overlaps, `seed ${seed}, delay ${delay}, obstacle ${obstacle.type} at ${active.distance.toFixed(2)}, player at ${distance.toFixed(2)}`);
          }
        }
      }
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

test('the previous best survives the update and unavailable storage falls back to zero', () => {
  for (const input of ['NaN', 'Infinity', '-10', 'bad', null]) assert.equal(loadRecord({ getItem: () => input }), 0);
  assert.equal(loadRecord(null), 0);
  assert.equal(loadRecord({ getItem() { throw new Error('blocked'); } }), 0);
  assert.equal(loadRecord({ getItem: (key) => key === 'rilakkumaSweetRun.best' ? 123 : null }), 123);
});
