import { clamp } from './motionMath';

export interface WordmarkCharSpring {
  y: number;
  vy: number;
  energy: number;
}

export interface WordmarkCharPose {
  yPx: number;
  tiltDeg: number;
  wght: number;
  wdth: number;
  /** 0..1 spectral color intensity (0 = crisp #F6F3EB, 1 = full spectral emission hex) */
  colorMix: number;
  spectralHex: string;
}

/** Authentic spectral emission color assigned per character of "656.3nm" */
export const WORDMARK_SPECTRAL_COLORS: readonly string[] = [
  '#FF1F71', // 6 — H-alpha
  '#FF2A2A', // 5 — Li I
  '#00E676', // 6 — Li II
  '#00D8FF', // . — H-beta
  '#1822FF', // 3 — H-gamma
  '#6A2BFF', // n — H-delta
  '#FFB800', // m — Solar Epilogue Gold
] as const;

export function createWordmarkSprings(count = 7): WordmarkCharSpring[] {
  return Array.from({ length: count }, () => ({ y: 0, vy: 0, energy: 0 }));
}

/**
 * Injects kinetic impulse into a single glyph (hover sweep or click detonation).
 */
export function exciteWordmarkChar(
  springs: WordmarkCharSpring[],
  index: number,
  impulseVy: number,
  energyBoost = 1.0
): void {
  const s = springs[index];
  if (!s) return;
  s.vy = clamp(s.vy + impulseVy, -26, 26);
  s.energy = clamp(Math.max(s.energy, energyBoost), 0, 1);
}

/**
 * Fires a high-amplitude standing wave centered at index that bounces cleanly across the wordmark.
 */
export function detonateWordmarkWave(
  springs: WordmarkCharSpring[],
  originIndex: number
): void {
  const n = springs.length;
  for (let i = 0; i < n; i++) {
    const dist = Math.abs(i - originIndex);
    const falloff = Math.exp(-dist * 0.42);
    const phaseSign = dist % 2 === 0 ? -1 : 0.45;
    springs[i].vy = clamp(springs[i].vy + phaseSign * 19.5 * falloff, -28, 28);
    springs[i].energy = clamp(Math.max(springs[i].energy, 0.98 * falloff), 0, 1);
  }
}

/**
 * Steps the 1D coupled Newton's Cradle spring-wave solver.
 * Neighbor coupling = 0.22 propagates traveling elastic shockwaves across all 7 glyphs.
 * Returns total normalized kinetic energy [0..1] for driving harmonic emission hairlines.
 */
export function stepCoupledWordmarkSprings(
  springs: WordmarkCharSpring[],
  dtFactor: number
): { poses: WordmarkCharPose[]; totalEnergy: number } {
  const n = springs.length;
  const stiffness = 0.165;
  const coupling = 0.22;
  const damping = Math.pow(0.9, dtFactor);

  // Compute coupled accelerations synchronously from current displacements
  const acc = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const self = springs[i].y;
    let neighborPull = 0;
    if (i > 0) neighborPull += springs[i - 1].y - self;
    if (i < n - 1) neighborPull += springs[i + 1].y - self;
    acc[i] = -stiffness * self + coupling * neighborPull;
  }

  let energySum = 0;
  for (let i = 0; i < n; i++) {
    const s = springs[i];
    s.vy = (s.vy + acc[i] * dtFactor) * damping;
    s.y = clamp(s.y + s.vy * dtFactor, -36, 36);

    const kinetic = clamp((Math.abs(s.y) / 22 + Math.abs(s.vy) / 14) * 0.85, 0, 1);
    s.energy = Math.max(kinetic, s.energy * Math.pow(0.935, dtFactor));

    if (Math.abs(s.y) < 0.04 && Math.abs(s.vy) < 0.04 && s.energy < 0.01) {
      s.y = 0;
      s.vy = 0;
      s.energy = 0;
    }
    energySum += s.energy;
  }

  const poses: WordmarkCharPose[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const s = springs[i];
    const leftY = i > 0 ? springs[i - 1].y : s.y;
    const rightY = i < n - 1 ? springs[i + 1].y : s.y;
    const slope = (rightY - leftY) * 0.5;
    const e = clamp(s.energy, 0, 1);

    // Bricolage Grotesque morph: wght 800 -> 200 -> 800, wdth 98 -> 75 -> 100
    const wght = clamp(800 - e * 560, 200, 800);
    const wdth = clamp(98 - Math.max(0, -s.y / 28) * 23 + Math.max(0, s.y / 28) * 6, 75, 100);
    const tiltDeg = clamp(slope * 0.42, -9, 9);

    poses[i] = {
      yPx: Number(s.y.toFixed(2)),
      tiltDeg: Number(tiltDeg.toFixed(2)),
      wght: Number(wght.toFixed(0)),
      wdth: Number(wdth.toFixed(1)),
      colorMix: Number(e.toFixed(3)),
      spectralHex: WORDMARK_SPECTRAL_COLORS[i % WORDMARK_SPECTRAL_COLORS.length],
    };
  }

  return {
    poses,
    totalEnergy: Number(clamp(energySum / Math.max(1, n), 0, 1).toFixed(3)),
  };
}

export interface MarqueeState {
  offsetPx: number;
  currentSpeedPxPerSec: number;
}

/**
 * Integrates opposing velocity-coupled marquee with eddy-current hover braking
 * and zero-seam modulo wrapping across a single track width.
 */
export function stepMarqueeOffset(
  state: MarqueeState,
  params: {
    baseDirection: -1 | 1;
    baseCruiseSpeed: number;
    scrollVelocity: number;
    isBraking: boolean;
    trackWidth: number;
    dtSec: number;
  }
): { offsetPx: number; slntDeg: number; chromaPx: number } {
  const brakeFactor = params.isBraking ? 0.15 : 1.0;
  // Scroll down (positive velocity) accelerates in baseDirection; scroll up reverses smoothly
  const scrollBoost = params.scrollVelocity * 16.5 * params.baseDirection;
  const targetSpeed = (params.baseDirection * params.baseCruiseSpeed + scrollBoost) * brakeFactor;

  // Smooth inertial response so direction reversals feel elastic
  const lerpAlpha = clamp(params.dtSec * 6.5, 0.02, 0.35);
  state.currentSpeedPxPerSec += (targetSpeed - state.currentSpeedPxPerSec) * lerpAlpha;

  const span = Math.max(1, params.trackWidth);
  state.offsetPx += state.currentSpeedPxPerSec * params.dtSec;

  // Seamless modulo wrap inside [-span, 0)
  state.offsetPx = ((state.offsetPx % span) + span) % span;
  if (state.offsetPx > 0) {
    state.offsetPx -= span;
  }

  const excessSpeed = Math.max(0, Math.abs(state.currentSpeedPxPerSec) - params.baseCruiseSpeed);
  const normShear = clamp(excessSpeed / 460, 0, 1);
  const slntDeg = Number((-normShear * 10).toFixed(2));
  const chromaPx = Number((normShear * 3.8).toFixed(2));

  return {
    offsetPx: Number(state.offsetPx.toFixed(2)),
    slntDeg,
    chromaPx,
  };
}

/**
 * Blends hex color from crisp Ceramic Paper (#F6F3EB) toward a spectral emission hex.
 */
export function mixPaperToHex(targetHex: string, mix: number): string {
  const t = clamp(mix, 0, 1);
  if (t <= 0.01) return '#F6F3EB';
  const clean = targetHex.replace('#', '');
  const tr = parseInt(clean.slice(0, 2), 16);
  const tg = parseInt(clean.slice(2, 4), 16);
  const tb = parseInt(clean.slice(4, 6), 16);

  const r = Math.round(246 + (tr - 246) * t);
  const g = Math.round(243 + (tg - 243) * t);
  const b = Math.round(235 + (tb - 235) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
