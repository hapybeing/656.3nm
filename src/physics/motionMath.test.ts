import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stepSpring,
  computeDopplerVars,
  precomputeFluxEquilibrium,
  evaluateMhdRingPath,
  computeCharFieldTargets,
} from './motionMath';

test('stepSpring converges cleanly toward target with crisp overshoot', () => {
  const s = { pos: 220, vel: 0 };
  let maxSeen = 220;
  for (let i = 0; i < 60; i++) {
    stepSpring(s, 800, 0.14, 0.72, 1);
    if (s.pos > maxSeen) maxSeen = s.pos;
  }
  assert.ok(maxSeen > 800, 'Expected crisp spring overshoot past 800');
  assert.ok(Math.abs(s.pos - 800) < 0.5, 'Expected convergence to 800');
});

test('computeDopplerVars snaps to zero at rest and clamps at extreme scroll velocities', () => {
  assert.deepEqual(computeDopplerVars(0.02), { slnt: 0, chromaPx: 0 });

  const fastDown = computeDopplerVars(80);
  assert.equal(fastDown.slnt, -10);
  assert.equal(fastDown.chromaPx, 7);

  const fastUp = computeDopplerVars(-80);
  assert.equal(fastUp.slnt, -10);
  assert.equal(fastUp.chromaPx, -7);

  const mid = computeDopplerVars(10);
  assert.equal(mid.slnt, -3.2);
  assert.equal(mid.chromaPx, 1.8);
});

test('precomputeFluxEquilibrium and evaluateMhdRingPath generate valid 80-vertex deformed paths', () => {
  const rings = precomputeFluxEquilibrium();
  assert.equal(rings.length, 14);
  assert.equal(rings[0].vertices.length, 80);

  const resting = evaluateMhdRingPath(rings[13], 1.2, 520, 450, 0);
  assert.ok(resting.d.startsWith('M') && resting.d.endsWith('Z'));
  assert.ok(!resting.d.includes('NaN'));
  assert.equal(resting.strokeWidth, 1.4);

  // Pointer near outer shell should increase strokeWidth under magnetic pressure
  const outerVert = rings[13].vertices[0];
  const deflected = evaluateMhdRingPath(
    rings[13],
    1.2,
    outerVert.x0,
    outerVert.y0,
    1
  );
  assert.ok(deflected.strokeWidth > 2.2);
  assert.notEqual(deflected.d, resting.d);

  // Verify smooth C-infinity contour continuity (no step-function jumps between adjacent vertices)
  const innerDeflected = evaluateMhdRingPath(rings[4], 1.2, 540, 450, 1);
  const pts = innerDeflected.d
    .slice(1, -1)
    .split('L')
    .map((pair) => pair.split(',').map(Number));
  let maxJump = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const step = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (step > maxJump) maxJump = step;
  }
  assert.ok(maxJump < 28, `Expected smooth contour without kinks, got max vertex step ${maxJump}`);
});

test('computeCharFieldTargets carves glyph axes inside 230px ionization radius and ripples on idle', () => {
  const center = computeCharFieldTargets({
    charX: 400,
    charY: 300,
    pointerX: 400,
    pointerY: 300,
    pointerStrength: 1,
    idleStrength: 0,
    timeSec: 0,
  });
  assert.equal(Math.round(center.wght), 220);
  assert.equal(Math.round(center.wdth), 75);
  assert.equal(Math.round(center.opsz), 12);
  assert.equal(Math.round(center.y), -11);
  assert.equal(center.chroma, 3);

  const far = computeCharFieldTargets({
    charX: 900,
    charY: 300,
    pointerX: 400,
    pointerY: 300,
    pointerStrength: 1,
    idleStrength: 0,
    timeSec: 0,
  });
  assert.equal(far.wght, 800);
  assert.equal(far.wdth, 92);
  assert.equal(far.opsz, 96);
  assert.equal(far.y, 0);

  const idle = computeCharFieldTargets({
    charX: 400,
    charY: 300,
    pointerX: -999,
    pointerY: -999,
    pointerStrength: 0,
    idleStrength: 1,
    timeSec: 1.5,
  });
  assert.ok(idle.wght <= 800 && idle.wght >= 560);
  assert.ok(idle.y <= 0 && idle.y >= -3);
});
