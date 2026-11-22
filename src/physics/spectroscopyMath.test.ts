import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACT2_TIMING,
  buildOscilloscopeCurvePath,
  computeAct2ScrollState,
  computeCenterOutCharPose,
  generateFraunhoferSpectrometer,
} from './spectroscopyMath';

test('computeAct2ScrollState maps 0..1 progress to 0..12.4ms, 12..84% pellet drop, and shockwaves', () => {
  const start = computeAct2ScrollState(0);
  assert.equal(start.timeMs, 0);
  assert.equal(start.pelletYPct, 12);
  assert.equal(start.activeStageIndex, 0);
  assert.equal(start.layerClipRadiiPct[1], 0);

  const midLi1Wipe = computeAct2ScrollState(0.28);
  assert.ok(midLi1Wipe.layerClipRadiiPct[1] > 40 && midLi1Wipe.layerClipRadiiPct[1] < 155);
  assert.equal(midLi1Wipe.shockfront.active, true);
  assert.equal(midLi1Wipe.shockfront.stageIndex, 1);

  const stage2Anchor = computeAct2ScrollState(ACT2_TIMING.anchors[2]);
  assert.equal(stage2Anchor.activeStageIndex, 2);
  assert.equal(stage2Anchor.layerClipRadiiPct[2], 155);

  const end = computeAct2ScrollState(1);
  assert.equal(end.timeMs, 12.4);
  assert.equal(end.pelletYPct, 84);
  assert.equal(end.activeStageIndex, 3);
  assert.equal(end.layerClipRadiiPct[3], 155);
});

test('computeCenterOutCharPose ignites center glyphs before edges and settles cleanly', () => {
  const centerMid = computeCenterOutCharPose(5, 11, 0.35);
  const edgeMid = computeCenterOutCharPose(0, 11, 0.35);
  assert.ok(centerMid.wdth > edgeMid.wdth, 'Center glyph should expand ahead of edge glyph');
  assert.ok(centerMid.rotateXDeg > edgeMid.rotateXDeg, 'Center glyph should hinge open ahead of edge');

  const settled = computeCenterOutCharPose(0, 11, 1);
  assert.equal(settled.rotateXDeg, 0);
  assert.equal(settled.slnt, 0);
  assert.ok(Math.abs(settled.wdth - 124) < 1);
  assert.ok(Math.abs(settled.wght - 900) < 1);
});

test('generateFraunhoferSpectrometer produces ~70 calibrated lines across 380nm..700nm', () => {
  const ticks = generateFraunhoferSpectrometer(380, 700);
  assert.ok(ticks.length >= 68 && ticks.length <= 76);
  const emissions = ticks.filter((t) => t.isEmission);
  assert.equal(emissions.length, 6);
  for (const t of ticks) {
    assert.ok(t.positionPct >= 0 && t.positionPct <= 100);
  }
});

test('buildOscilloscopeCurvePath returns a valid finite SVG path peaking at activeNm', () => {
  const d = buildOscilloscopeCurvePath({ activeNm: 548.5, spikeBoost: 0.6, timeSec: 1.2 });
  assert.ok(d.startsWith('M0.0,'));
  assert.ok(!d.includes('NaN'));
  assert.ok(d.split('L').length === 181);
});
