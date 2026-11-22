import { clamp } from './motionMath';

export interface LawsonDialConfig {
  id: 'density' | 'temperature' | 'confinement';
  min: number;
  max: number;
  defaultVal: number;
  accent: string;
}

export const LAWSON_DIAL_CONFIGS: readonly LawsonDialConfig[] = [
  { id: 'density', min: 0.2, max: 3.5, defaultVal: 1.4, accent: '#FF1F71' },
  { id: 'temperature', min: 20.0, max: 260.0, defaultVal: 150.0, accent: '#00E676' },
  { id: 'confinement', min: 0.4, max: 6.0, defaultVal: 3.2, accent: '#1822FF' },
] as const;

/** D-T Lawson Breakeven threshold in 10^21 keV·s·m^-3 */
export const LAWSON_BREAKEVEN_THRESHOLD = 6.0;
/** Conversion constant: 1 keV = 11.604 MK */
export const MK_PER_KEV = 11.604;

export interface LawsonTelemetry {
  density10e20: number;
  temperatureMK: number;
  temperatureKeV: number;
  confinementSec: number;
  /** Triple product in units of 10^21 keV·s·m^-3 */
  tripleProduct10e21: number;
  /** Lawson fusion gain Q (1.00 = breakeven, >1.00 = burning plasma) */
  qGain: number;
  isIgnited: boolean;
  /** Normalized progress 0..1 across the 24-segment spectral bar */
  barFillRatio: number;
}

export interface ThermalStressPose {
  /** Normalized stress 0..1 spanning Q in [0.65..0.999] (snaps to 0 when ignited) */
  stress: number;
  jitterPx: number;
  wdth: number;
  wght: number;
  chromaPx: number;
  crosshairScale: number;
}

export interface DialInertiaState {
  /** Normalized value [0..1] */
  norm: number;
  /** Normalized angular velocity per 16.67ms frame */
  vel: number;
  /** Last crossed 6-degree magnetic detent index (0..59) */
  detentIdx: number;
}

export function valueToNorm(val: number, cfg: LawsonDialConfig): number {
  return clamp((val - cfg.min) / (cfg.max - cfg.min), 0, 1);
}

export function normToValue(norm: number, cfg: LawsonDialConfig): number {
  return cfg.min + clamp(norm, 0, 1) * (cfg.max - cfg.min);
}

/**
 * Computes real D-T Lawson Triple Product and fusion gain Q.
 * T_keV = T_MK / 11.604
 * P = (n * 10^20) * T_keV * tau_E = (n * T_keV * tau_E / 10) * 10^21 keV·s·m^-3
 * Breakeven Q = 1.00 at P = 6.0 * 10^21 keV·s·m^-3; scales up to Q > 5.0 when maxed.
 */
export function computeLawsonTelemetry(
  density10e20: number,
  temperatureMK: number,
  confinementSec: number
): LawsonTelemetry {
  const n = Math.max(0.05, density10e20);
  const tMK = Math.max(1, temperatureMK);
  const tau = Math.max(0.05, confinementSec);

  const temperatureKeV = tMK / MK_PER_KEV;
  const tripleProduct10e21 = (n * temperatureKeV * tau) / 10;

  // Linear up to breakeven (Q = 1.00 at 6.0e21), then smooth thermal reactivity boost above 1.00
  const rawRatio = tripleProduct10e21 / LAWSON_BREAKEVEN_THRESHOLD;
  const qGain =
    rawRatio <= 1
      ? rawRatio
      : 1 + Math.pow(rawRatio - 1, 1.08) * 1.12;

  const isIgnited = qGain >= 1.0;

  // Bar fills 0 -> 75% up to Q=1.00, then 75% -> 100% across Q=1.00..3.50
  const barFillRatio = isIgnited
    ? clamp(0.75 + ((qGain - 1) / 2.5) * 0.25, 0.75, 1)
    : clamp(qGain * 0.75, 0, 0.75);

  return {
    density10e20: n,
    temperatureMK: tMK,
    temperatureKeV,
    confinementSec: tau,
    tripleProduct10e21,
    qGain,
    isIgnited,
    barFillRatio,
  };
}

/**
 * Maps Q in [0.65..0.999] into pre-ignition thermal stress parameters.
 * Immediately resolves to calm harmonic lock (stress = 0) when ignited (Q >= 1.00).
 */
export function computeThermalStress(qGain: number): ThermalStressPose {
  if (qGain >= 1.0) {
    return {
      stress: 0,
      jitterPx: 0,
      wdth: 96,
      wght: 800,
      chromaPx: 0,
      crosshairScale: 0.94,
    };
  }

  const stress = clamp((qGain - 0.65) / 0.34, 0, 1);
  const curved = stress * stress;
  return {
    stress: Number(stress.toFixed(3)),
    jitterPx: Number((curved * 3.5).toFixed(2)),
    wdth: Number((92 + stress * 8).toFixed(1)),
    wght: Number((760 + stress * 40).toFixed(0)),
    chromaPx: Number((curved * 6.0).toFixed(2)),
    crosshairScale: Number((1 - stress * 0.06).toFixed(3)),
  };
}

/**
 * Steps a single rotational-inertia dial with damped coasting momentum
 * and subtle magnetic snap-ticks at every 6° degree mark (60 detents per revolution).
 * Returns true if a 6° detent boundary was crossed on this step.
 */
export function stepDialInertia(
  state: DialInertiaState,
  dtFactor: number,
  isDragging: boolean
): boolean {
  const prevDetent = state.detentIdx;

  if (!isDragging) {
    state.norm += state.vel * dtFactor;
    state.vel *= Math.pow(0.88, dtFactor);

    if (state.norm < 0) {
      state.norm = 0;
      state.vel = 0;
    } else if (state.norm > 1) {
      state.norm = 1;
      state.vel = 0;
    }

    // Subtle magnetic detent pull when coasting slowly near a 6° mark
    if (Math.abs(state.vel) > 0.0001 && Math.abs(state.vel) < 0.0045) {
      const nearestDetent = Math.round(state.norm * 60) / 60;
      const diff = nearestDetent - state.norm;
      state.norm += diff * 0.18 * dtFactor;
      if (Math.abs(diff) < 0.0005 && Math.abs(state.vel) < 0.0004) {
        state.norm = nearestDetent;
        state.vel = 0;
      }
    }
  }

  state.norm = clamp(state.norm, 0, 1);
  const nextDetent = Math.round(state.norm * 60);
  state.detentIdx = nextDetent;
  return nextDetent !== prevDetent;
}

/**
 * Shortest signed angular delta in radians between two angles, preventing ±π wrap jumps.
 */
export function shortestAngleDelta(prevAngle: number, nextAngle: number): number {
  let delta = nextAngle - prevAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

const SPECTRAL_BAR_PALETTE = [
  '#FF1F71',
  '#FF2A2A',
  '#00E676',
  '#00D8FF',
  '#1822FF',
  '#6A2BFF',
  '#FFB800',
] as const;

export function getSpectralSegmentColor(index: number, totalSegments = 24): string {
  const u = clamp(index / Math.max(1, totalSegments - 1), 0, 1);
  const stopIdx = Math.min(
    SPECTRAL_BAR_PALETTE.length - 1,
    Math.floor(u * SPECTRAL_BAR_PALETTE.length)
  );
  return SPECTRAL_BAR_PALETTE[stopIdx];
}

/**
 * Generates dual phase-locked standing-wave SVG paths for the burning plasma Q >= 1.00 strip.
 */
export function buildFusionBurnWavePaths(params: {
  qGain: number;
  timeSec: number;
  width?: number;
  height?: number;
  samples?: number;
}): { primary: string; harmonic: string } {
  const width = params.width ?? 640;
  const height = params.height ?? 32;
  const samples = params.samples ?? 96;
  const midY = height * 0.5;
  const excess = clamp((params.qGain - 1.0) / 3.0, 0, 1);
  const amp1 = 5.5 + excess * 7.5;
  const amp2 = 3.5 + excess * 6.0;
  const freq = 2.8 + excess * 2.2;
  const phase = params.timeSec * (4.2 + excess * 3.8);

  let primary = '';
  let harmonic = '';

  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const x = u * width;
    const envelope = Math.sin(u * Math.PI);
    const y1 =
      midY +
      Math.sin(u * Math.PI * 2 * freq + phase) *
        Math.cos(u * Math.PI * 2 - phase * 0.5) *
        amp1 *
        envelope;
    const y2 =
      midY +
      Math.sin(u * Math.PI * 2 * (freq * 1.5) - phase * 1.25) *
        amp2 *
        envelope;

    const cmd = i === 0 ? 'M' : 'L';
    primary += `${cmd}${x.toFixed(1)},${y1.toFixed(1)}`;
    harmonic += `${cmd}${x.toFixed(1)},${y2.toFixed(1)}`;
  }

  return { primary, harmonic };
}
