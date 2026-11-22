import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWordmarkSprings,
  detonateWordmarkWave,
  exciteWordmarkChar,
  mixPaperToHex,
  stepCoupledWordmarkSprings,
  stepMarqueeOffset,
} from './epilogueMath';

test('coupled Newton cradle wordmark springs propagate shockwave to neighboring characters', () => {
  const springs = createWordmarkSprings(7);
  exciteWordmarkChar(springs, 3, -18, 1.0);

  let neighborMoved = false;
  for (let i = 0; i < 20; i++) {
    const { poses, totalEnergy } = stepCoupledWordmarkSprings(springs, 1);
    assert.equal(poses.length, 7);
    assert.ok(totalEnergy >= 0 && totalEnergy <= 1);
    if (Math.abs(poses[2].yPx) > 1.0 && Math.abs(poses[4].yPx) > 1.0) {
      neighborMoved = true;
    }
  }
  assert.equal(neighborMoved, true, 'Disturbing center glyph must propagate wave to neighbors');

  // Detonation excites entire 7-char wordmark cleanly
  detonateWordmarkWave(springs, 0);
  const after = stepCoupledWordmarkSprings(springs, 1);
  assert.ok(after.totalEnergy > 0.35);
});

test('stepMarqueeOffset accelerates with scroll, reverses cleanly, brakes on hover, and wraps modulo trackWidth', () => {
  const state = { offsetPx: 0, currentSpeedPxPerSec: -42 };
  const trackWidth = 800;

  // Normal cruise + scroll down boost
  const fast = stepMarqueeOffset(state, {
    baseDirection: -1,
    baseCruiseSpeed: 42,
    scrollVelocity: 30,
    isBraking: false,
    trackWidth,
    dtSec: 0.05,
  });
  assert.ok(fast.offsetPx <= 0 && fast.offsetPx >= -trackWidth);
  assert.ok(fast.slntDeg < 0);

  // Upward scroll reverses velocity direction
  for (let i = 0; i < 30; i++) {
    stepMarqueeOffset(state, {
      baseDirection: -1,
      baseCruiseSpeed: 42,
      scrollVelocity: -25,
      isBraking: false,
      trackWidth,
      dtSec: 0.05,
    });
  }
  assert.ok(state.currentSpeedPxPerSec > 0, 'Scrolling up should reverse Band A direction');

  // Hover eddy-current braking slows speed smoothly toward 15% cruise
  const brakeState = { offsetPx: -100, currentSpeedPxPerSec: -42 };
  for (let i = 0; i < 40; i++) {
    stepMarqueeOffset(brakeState, {
      baseDirection: -1,
      baseCruiseSpeed: 42,
      scrollVelocity: 0,
      isBraking: true,
      trackWidth,
      dtSec: 0.05,
    });
  }
  assert.ok(Math.abs(brakeState.currentSpeedPxPerSec) < 10);

  assert.equal(mixPaperToHex('#FF1F71', 0), '#F6F3EB');
  assert.equal(mixPaperToHex('#FF1F71', 1), 'rgb(255, 31, 113)');
});
