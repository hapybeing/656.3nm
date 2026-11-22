import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFusionBurnWavePaths,
  computeLawsonTelemetry,
  computeThermalStress,
  LAWSON_DIAL_CONFIGS,
  normToValue,
  shortestAngleDelta,
  stepDialInertia,
  valueToNorm,
} from './lawsonMath';

test('computeLawsonTelemetry computes exact keV conversion, triple product, and breakeven crossing', () => {
  // Default calibration (n=1.40, T=150MK, tau=3.20s) sits right below breakeven
  const base = computeLawsonTelemetry(1.4, 150, 3.2);
  assert.ok(Math.abs(base.temperatureKeV - 12.9265) < 0.01);
  assert.ok(Math.abs(base.tripleProduct10e21 - 5.791) < 0.02);
  assert.equal(base.isIgnited, false);
  assert.ok(base.qGain > 0.9 && base.qGain < 1.0);

  // Pushing across breakeven (n=2.0, T=180MK, tau=3.8s) ignites cleanly
  const ignited = computeLawsonTelemetry(2.0, 180, 3.8);
  assert.equal(ignited.isIgnited, true);
  assert.ok(ignited.qGain > 1.8);

  // Max dials reach Q > 5.0
  const maxQ = computeLawsonTelemetry(3.5, 260, 6.0);
  assert.ok(maxQ.qGain > 5.0);
});

test('computeThermalStress ramps from 0.65..0.99 Q and snaps to calm harmonic lock at ignition', () => {
  const calm = computeThermalStress(0.4);
  assert.equal(calm.stress, 0);
  assert.equal(calm.jitterPx, 0);

  const highStress = computeThermalStress(0.95);
  assert.ok(highStress.stress > 0.8);
  assert.ok(highStress.jitterPx > 2.0);
  assert.ok(highStress.chromaPx > 3.5);

  const locked = computeThermalStress(1.45);
  assert.equal(locked.stress, 0);
  assert.equal(locked.jitterPx, 0);
  assert.equal(locked.chromaPx, 0);
});

test('stepDialInertia coasts with momentum, snaps to 6-deg detents, and shortestAngleDelta avoids wrap jumps', () => {
  const state = { norm: 0.4, vel: 0.04, detentIdx: 24 };
  let crossed = false;
  for (let i = 0; i < 40; i++) {
    if (stepDialInertia(state, 1, false)) crossed = true;
  }
  assert.equal(crossed, true);
  assert.ok(state.norm > 0.4);
  assert.ok(Math.abs(state.vel) < 0.002);

  // Wrap-around across +PI / -PI boundary stays small
  const d = shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1);
  assert.ok(Math.abs(d - 0.2) < 1e-6);

  // Round-trip value <-> norm
  const cfg = LAWSON_DIAL_CONFIGS[0];
  assert.ok(Math.abs(normToValue(valueToNorm(1.4, cfg), cfg) - 1.4) < 1e-6);
});

test('buildFusionBurnWavePaths produces finite primary and harmonic SVG paths', () => {
  const { primary, harmonic } = buildFusionBurnWavePaths({
    qGain: 2.2,
    timeSec: 1.5,
  });
  assert.ok(primary.startsWith('M0.0,'));
  assert.ok(harmonic.startsWith('M0.0,'));
  assert.ok(!primary.includes('NaN'));
  assert.ok(!harmonic.includes('NaN'));
});
