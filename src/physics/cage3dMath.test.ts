import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDisruptionFactor,
  computeHeadlinePinch,
  computeMagneticPressureMPa,
  evaluateMagneticAxisPoint,
  evaluateMagneticIslandPoint,
  evaluateModularCoilPoint,
  evaluatePlasmaSurfacePoint,
  projectPoint3D,
} from './cage3dMath';

test('computeMagneticPressureMPa matches exact B^2 / (2 * mu_0) physics', () => {
  assert.equal(computeMagneticPressureMPa(0), 0);
  // 12^2 / (2 * 4*pi*1e-7) / 1e6 = 57.2957... -> 57.3 MPa
  assert.equal(computeMagneticPressureMPa(12), 57.3);
  // 20^2 / (2 * 4*pi*1e-7) / 1e6 = 159.1549... -> 159.2 MPa
  assert.equal(computeMagneticPressureMPa(20), 159.2);
});

test('computeDisruptionFactor and computeHeadlinePinch couple B-field to typography & warning state', () => {
  assert.equal(computeDisruptionFactor(12), 0);
  assert.equal(computeDisruptionFactor(3), 0);
  assert.ok(computeDisruptionFactor(0.8) > 0.7);

  const highB = computeHeadlinePinch(20);
  assert.equal(highB.wdth, 75);
  assert.equal(highB.wght, 800);
  assert.equal(highB.letterSpacingEm, -0.06);
  assert.equal(highB.isDisrupted, false);

  const lowB = computeHeadlinePinch(0.5);
  assert.equal(lowB.isDisrupted, true);
  assert.ok(lowB.wght < 400);
  assert.ok(lowB.wdth > 95);
});

test('3D Tokamak <-> Stellarator manifold evaluation and projection stay finite across morphT', () => {
  const tokPoint = evaluatePlasmaSurfacePoint(0.4, 1.1, {
    morphT: 0,
    bFieldTesla: 12,
    timeSec: 0,
  });
  const stelPoint = evaluatePlasmaSurfacePoint(0.4, 1.1, {
    morphT: 1,
    bFieldTesla: 12,
    timeSec: 0,
  });
  assert.notEqual(tokPoint.y, stelPoint.y, 'Stellarator morph should displace vertical axis/cross-section');

  // Verify magnetic pinch shrinks minor radius at 20T vs 4T
  const rLoose = Math.hypot(
    evaluatePlasmaSurfacePoint(0, 0, { morphT: 0, bFieldTesla: 4, timeSec: 0 }).x - 1.62,
    evaluatePlasmaSurfacePoint(0, 0, { morphT: 0, bFieldTesla: 4, timeSec: 0 }).y
  );
  const rPinched = Math.hypot(
    evaluatePlasmaSurfacePoint(0, 0, { morphT: 0, bFieldTesla: 20, timeSec: 0 }).x - 1.62,
    evaluatePlasmaSurfacePoint(0, 0, { morphT: 0, bFieldTesla: 20, timeSec: 0 }).y
  );
  assert.ok(rPinched < rLoose, 'Higher Tesla B-field must compress plasma minor radius');

  const coil = evaluateModularCoilPoint(3, 18, 0.7, { morphT: 1, bFieldTesla: 15, timeSec: 1 });
  const island = evaluateMagneticIslandPoint(2, 0.9, 0.5, { morphT: 1, bFieldTesla: 15, timeSec: 1 });
  const axis = evaluateMagneticAxisPoint(1.2, { morphT: 1, bFieldTesla: 0.8, timeSec: 2.5 });

  for (const v of [tokPoint, stelPoint, coil, island, axis]) {
    const p = projectPoint3D(v, 0.5, 0.4, 120, 300, 300);
    assert.ok(Number.isFinite(p.sx) && Number.isFinite(p.sy));
    assert.ok(p.alpha >= 0.14 && p.alpha <= 0.95);
  }
});
