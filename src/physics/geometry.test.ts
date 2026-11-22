import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMagneticFluxContours,
  generateSpectrometerLines,
  generateTokamakGeometry,
  generateStellaratorGeometry,
  generateDialTicks,
  generateDialArcPath,
  polarToCartesian,
} from './geometry';

test('generateMagneticFluxContours produces 14 valid closed D-shaped flux paths', () => {
  const contours = generateMagneticFluxContours();
  assert.equal(contours.length, 14);
  for (const c of contours) {
    assert.ok(c.d.startsWith('M'));
    assert.ok(c.d.endsWith('Z'));
    assert.ok(!c.d.includes('NaN'));
    assert.equal(c.strokeWidth, 1.5);
  }
  assert.equal(contours[0].stroke, '#FF1F71');
  assert.equal(contours[1].stroke, '#00D8FF');
  assert.equal(contours[2].stroke, '#111114');
});

test('generateSpectrometerLines maps all 4 Act 2 stages within 0..100% bounds', () => {
  const lines = generateSpectrometerLines(410, 671);
  const stageIds = lines.filter((l) => l.stageId).map((l) => l.stageId);
  assert.deepEqual(stageIds.sort(), ['h-alpha', 'h-beta', 'li-1', 'li-2']);
  for (const line of lines) {
    assert.ok(line.positionPct >= 0 && line.positionPct <= 100);
  }
});

test('generateTokamakGeometry and generateStellaratorGeometry produce valid topology geometry', () => {
  const tok = generateTokamakGeometry(300, 300);
  assert.equal(tok.concentricRadii.length, 6);
  assert.equal(tok.radialSpokes.length, 16);
  assert.equal(tok.outerCoils.length, 16);

  const stel = generateStellaratorGeometry(300, 300);
  assert.equal(stel.ribbons.length, 7);
  assert.equal(stel.islands.length, 5);
  assert.ok(stel.coreAxis.startsWith('M') && stel.coreAxis.endsWith('Z'));
  for (const r of stel.ribbons) {
    assert.ok(!r.d.includes('NaN'));
  }
});

test('generateDialTicks and generateDialArcPath produce 60 precision ticks and valid arc', () => {
  const ticks = generateDialTicks(150, 150, 132, 60);
  assert.equal(ticks.length, 60);
  assert.equal(ticks.filter((t) => t.isMajor).length, 12);

  const top = polarToCartesian(150, 150, 100, 0);
  assert.equal(top.x, 150);
  assert.equal(top.y, 50);

  const arc = generateDialArcPath(150, 150, 108, 0.68);
  assert.ok(arc.startsWith('M 150 42 A 108 108 0 1 1'));
  assert.ok(!arc.includes('NaN'));
});
