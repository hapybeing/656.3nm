import { clamp } from './motionMath';

export interface Act2StageThresholds {
  thresholds: readonly [number, number, number, number];
  anchors: readonly [number, number, number, number];
  wipeWindow: number;
}

export const ACT2_TIMING: Act2StageThresholds = {
  thresholds: [0, 0.25, 0.55, 0.8],
  anchors: [0.08, 0.38, 0.67, 0.92],
  wipeWindow: 0.1,
};

export interface ShockfrontTelemetry {
  active: boolean;
  stageIndex: number;
  progress: number;
  radiusPct: number;
  radiusMm: number;
  originYPct: number;
  strength: number;
}

export interface Act2ScrollState {
  progress: number;
  timeMs: number;
  pelletYPct: number;
  activeStageIndex: number;
  /** Clip-path circle radius (%) for layers 1, 2, 3 (layer 0 is always full base). */
  layerClipRadiiPct: [number, number, number, number];
  /** Stage reveal progress 0..1 for each of the 4 stages (drives center-out typography). */
  stageReveals: [number, number, number, number];
  /** Instantaneous transition energy 0..1 peaking during active shockwave wipes. */
  transitionEnergy: number;
  shockfront: ShockfrontTelemetry;
}

export interface CenterOutCharPose {
  wdth: number;
  wght: number;
  slnt: number;
  rotateXDeg: number;
  opacity: number;
}

export interface FraunhoferTick {
  nm: number;
  positionPct: number;
  isEmission: boolean;
  isMajorScale: boolean;
  stageId?: 'h-alpha' | 'li-1' | 'li-2' | 'h-beta';
  label?: string;
  color: string;
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Computes all continuous scroll-scrubbed Act 2 spectroscopy & shockwave states
 * from normalized scroll progress [0..1]. Pure & deterministic for 60fps ref writes.
 */
export function computeAct2ScrollState(rawProgress: number): Act2ScrollState {
  const progress = clamp(rawProgress, 0, 1);
  const timeMs = Number((progress * 12.4).toFixed(3));
  const pelletYPct = Number((12 + progress * 72).toFixed(3));
  const { thresholds, wipeWindow } = ACT2_TIMING;

  const layerClipRadiiPct: [number, number, number, number] = [160, 0, 0, 0];
  const stageReveals: [number, number, number, number] = [1, 0, 0, 0];

  let activeStageIndex = 0;
  let transitionEnergy = 0;
  let shockfront: ShockfrontTelemetry = {
    active: false,
    stageIndex: 0,
    progress: 0,
    radiusPct: 0,
    radiusMm: 0,
    originYPct: pelletYPct,
    strength: 0,
  };

  // Stage 0 is immediately flat, upright, and 100% crisp on entry
  stageReveals[0] = 1;

  for (let i = 1; i <= 3; i++) {
    const start = thresholds[i];
    const localWipe = clamp((progress - start) / wipeWindow, 0, 1);
    // Tactile blast expansion: explosive initial launch with full mid-window visibility across viewport
    const easedWipe = localWipe >= 1 ? 1 : 1 - Math.pow(1 - localWipe, 1.85);
    const radiusPct = Number((easedWipe * 155).toFixed(2));
    layerClipRadiiPct[i] = radiusPct;

    // Character 3D hinge completes crisply within the first 0.07 scroll window of each stage
    stageReveals[i] = clamp((progress - start) / 0.07, 0, 1);

    if (progress >= start) {
      activeStageIndex = i;
    }

    // Active shockfront rides pixel-perfectly on the circular color-wipe seam
    if (localWipe > 0.002 && localWipe < 0.996) {
      const envelope = Math.sin(localWipe * Math.PI);
      if (envelope > transitionEnergy) {
        transitionEnergy = envelope;
        shockfront = {
          active: true,
          stageIndex: i,
          progress: localWipe,
          radiusPct,
          radiusMm: Number((easedWipe * 420).toFixed(1)),
          originYPct: pelletYPct,
          strength: Number(envelope.toFixed(3)),
        };
      }
    }
  }

  return {
    progress,
    timeMs,
    pelletYPct,
    activeStageIndex,
    layerClipRadiiPct,
    stageReveals,
    transitionEnergy: Number(transitionEnergy.toFixed(3)),
    shockfront,
  };
}

/**
 * Center-out radial character eruption for Roboto Flex stage headlines:
 * --wdth whips 25 -> 151 -> 124, --wght slams 100 -> 1000 -> 900,
 * --slnt snaps -10 -> 0, while hinging open in 3D from -80deg -> 0deg.
 */
export function computeCenterOutCharPose(
  charIndex: number,
  totalChars: number,
  revealProgress: number
): CenterOutCharPose {
  const safeTotal = Math.max(1, totalChars);
  const center = (safeTotal - 1) * 0.5;
  const maxDist = Math.max(1, center);
  const distNorm = Math.abs(charIndex - center) / maxDist;

  // Center ignites first; outer glyphs trail by up to 0.30 of reveal window
  const staggerDelay = distNorm * 0.3;
  const localT = clamp((revealProgress - staggerDelay) / (1 - 0.3), 0, 1);
  const eased = easeOutExpo(localT);

  // Overshoot bell peaking at localT ~ 0.45 for violent whip 25 -> 151 -> 124
  const overshootBell = Math.sin(Math.pow(localT, 0.72) * Math.PI);
  const wdth = clamp(25 + 99 * eased + 34 * overshootBell, 25, 151);
  const wght = clamp(100 + 800 * eased + 140 * overshootBell, 100, 1000);
  const slnt = clamp(-10 * (1 - eased), -10, 0);
  const rotateXDeg = Number((-80 * (1 - eased)).toFixed(2));
  const opacity = clamp(localT / 0.16, 0, 1);

  return {
    wdth: Number(wdth.toFixed(1)),
    wght: Number(wght.toFixed(1)),
    slnt: Number(slnt.toFixed(2)),
    rotateXDeg,
    opacity: Number(opacity.toFixed(3)),
  };
}

export const ATOMIC_EMISSION_PEAKS: readonly {
  nm: number;
  label: string;
  color: string;
  stageId?: 'h-alpha' | 'li-1' | 'li-2' | 'h-beta';
}[] = [
  { nm: 410.17, label: '410.17nm Hδ', color: '#6A2BFF' },
  { nm: 434.05, label: '434.05nm Hγ', color: '#1822FF' },
  { nm: 486.14, label: '486.14nm Hβ', color: '#00D8FF', stageId: 'h-beta' },
  { nm: 548.5, label: '548.50nm Li II', color: '#00E676', stageId: 'li-2' },
  { nm: 656.28, label: '656.28nm Hα', color: '#FF1F71', stageId: 'h-alpha' },
  { nm: 670.78, label: '670.78nm Li I', color: '#FF2A2A', stageId: 'li-1' },
] as const;

/**
 * Generates ~70 precision Fraunhofer / Balmer optical spectrometer ticks across 380nm..700nm.
 */
export function generateFraunhoferSpectrometer(
  minNm = 380,
  maxNm = 700
): FraunhoferTick[] {
  const span = maxNm - minNm;
  const toPct = (nm: number) => Number((((nm - minNm) / span) * 100).toFixed(3));
  const ticks: FraunhoferTick[] = [];

  // 65 regular calibrated 5nm optical spectrometer grid ticks (380..700)
  for (let nm = minNm; nm <= maxNm; nm += 5) {
    ticks.push({
      nm,
      positionPct: toPct(nm),
      isEmission: false,
      isMajorScale: nm % 20 === 0,
      color: 'currentColor',
    });
  }

  // True atomic emission wavelengths overlaid at exact physical positions
  for (const peak of ATOMIC_EMISSION_PEAKS) {
    ticks.push({
      nm: peak.nm,
      positionPct: toPct(peak.nm),
      isEmission: true,
      isMajorScale: true,
      stageId: peak.stageId,
      label: peak.label,
      color: peak.color,
    });
  }

  return ticks.sort((a, b) => a.nm - b.nm);
}

/**
 * Builds a live razor-sharp SVG oscilloscope spectral intensity curve spanning 380nm..700nm
 * with a prominent Gaussian emission spike locked dynamically onto activeNm.
 */
export function buildOscilloscopeCurvePath(params: {
  activeNm: number;
  spikeBoost?: number;
  timeSec?: number;
  width?: number;
  height?: number;
  minNm?: number;
  maxNm?: number;
  samples?: number;
}): string {
  const width = params.width ?? 1000;
  const height = params.height ?? 56;
  const minNm = params.minNm ?? 380;
  const maxNm = params.maxNm ?? 700;
  const samples = params.samples ?? 180;
  const timeSec = params.timeSec ?? 0;
  const boost = params.spikeBoost ?? 0;
  const span = maxNm - minNm;
  const baselineY = height - 4;
  const maxPeakH = height - 8;

  let path = '';
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const nm = minNm + u * span;
    const x = u * width;

    // Subtle high-frequency spectrometer noise floor
    const noise =
      0.018 * Math.sin(u * 92 + timeSec * 7.5) +
      0.012 * Math.cos(u * 173 - timeSec * 11.2) +
      0.02;

    // Authentic background emission shoulders at the 6 Balmer/Lithium lines
    let intensity = Math.max(0, noise);
    for (const peak of ATOMIC_EMISSION_PEAKS) {
      const dist = nm - peak.nm;
      const isActive = Math.abs(peak.nm - params.activeNm) < 2.0;
      const sigma = isActive ? 4.4 : 3.2;
      const amp = isActive ? 0.86 + 0.14 * boost : 0.16;
      intensity += amp * Math.exp(-(dist * dist) / (2 * sigma * sigma));
    }

    // Dynamic traveling Gaussian spike if activeNm is smoothly sweeping between peaks
    const activeDist = nm - params.activeNm;
    const dynamicPeak = (0.78 + 0.22 * boost) * Math.exp(-(activeDist * activeDist) / (2 * 4.8 * 4.8));
    intensity = Math.min(1, Math.max(intensity, dynamicPeak));

    const y = baselineY - intensity * maxPeakH;
    path += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }

  return path;
}
