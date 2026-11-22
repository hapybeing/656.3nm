export interface FluxContour {
  index: number;
  d: string;
  stroke: string;
  opacity: number;
  strokeWidth: number;
}

export interface SpectrometerLine {
  nm: number;
  positionPct: number;
  color: string;
  stageId?: 'h-alpha' | 'li-1' | 'li-2' | 'h-beta';
  isMajor: boolean;
}

export interface DialTick {
  index: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isMajor: boolean;
}

export interface PolarPoint {
  x: number;
  y: number;
}

/**
 * Generates 14 nested D-shaped / bean-shaped tokamak magnetic flux contours using
 * Miller equilibrium parametric equations:
 *   R(theta) = R0 + a * cos(theta + delta * sin(theta))
 *   Z(theta) = kappa * a * sin(theta)
 */
export function generateMagneticFluxContours(options?: {
  count?: number;
  cx?: number;
  cy?: number;
  maxMinorRadius?: number;
  delta?: number;
  kappa?: number;
  samples?: number;
}): FluxContour[] {
  const count = options?.count ?? 14;
  const cx = options?.cx ?? 520;
  const cy = options?.cy ?? 450;
  const maxMinorRadius = options?.maxMinorRadius ?? 218;
  const delta = options?.delta ?? 0.45;
  const kappa = options?.kappa ?? 1.65;
  const samples = options?.samples ?? 120;

  const contours: FluxContour[] = [];

  for (let i = 0; i < count; i++) {
    const t = (i + 1) / count;
    // Slight Shafranov shift pushes inner flux surfaces outward toward the low-field side
    const shafranovShift = (1 - t * t) * 42;
    const r0 = cx + shafranovShift;
    const a = maxMinorRadius * (0.14 + 0.86 * t);
    const localDelta = delta * (0.55 + 0.45 * t);
    const localKappa = 1.28 + (kappa - 1.28) * t;

    const commands: string[] = [];
    for (let s = 0; s <= samples; s++) {
      const theta = (s / samples) * Math.PI * 2;
      const x = r0 + a * Math.cos(theta + localDelta * Math.sin(theta));
      const y = cy + localKappa * a * Math.sin(theta);
      commands.push(`${s === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
    }
    commands.push('Z');

    // Alternate Balmer-Alpha Pink (#FF1F71), Balmer-Beta Cyan (#00D8FF), and low-opacity Ink (#111114)
    let stroke = '#111114';
    let opacity = 0.22;
    if (i % 3 === 0) {
      stroke = '#FF1F71';
      opacity = 0.72 + (1 - t) * 0.28;
    } else if (i % 3 === 1) {
      stroke = '#00D8FF';
      opacity = 0.65 + (1 - t) * 0.25;
    } else {
      stroke = '#111114';
      opacity = 0.16 + t * 0.12;
    }

    contours.push({
      index: i,
      d: commands.join(' '),
      stroke,
      opacity: Number(opacity.toFixed(3)),
      strokeWidth: 1.5,
    });
  }

  return contours;
}

/**
 * Computes normalized spectrometer barcode positions across [minNm, maxNm].
 */
export function generateSpectrometerLines(minNm = 410, maxNm = 671): SpectrometerLine[] {
  const span = maxNm - minNm;
  const clampPct = (nm: number) =>
    Number((((nm - minNm) / span) * 100).toFixed(3));

  const majorLines: Array<{
    nm: number;
    color: string;
    stageId?: 'h-alpha' | 'li-1' | 'li-2' | 'h-beta';
  }> = [
    { nm: 410.17, color: '#6A2BFF' },
    { nm: 434.05, color: '#1822FF' },
    { nm: 486.14, color: '#00D8FF', stageId: 'h-beta' },
    { nm: 548.5, color: '#00E676', stageId: 'li-2' },
    { nm: 656.28, color: '#FF1F71', stageId: 'h-alpha' },
    { nm: 670.78, color: '#FF2A2A', stageId: 'li-1' },
  ];

  // Authentic secondary atomic emission reference lines (He I, D, Li harmonics)
  const secondaryWavelengths = [
    414.4, 421.6, 447.15, 460.28, 471.31, 492.19, 501.57, 518.3, 531.0,
    562.4, 587.56, 610.36, 624.8, 639.2, 667.82,
  ];

  const lines: SpectrometerLine[] = [
    ...majorLines.map((line) => ({
      nm: line.nm,
      positionPct: clampPct(line.nm),
      color: line.color,
      stageId: line.stageId,
      isMajor: true,
    })),
    ...secondaryWavelengths.map((nm) => ({
      nm,
      positionPct: clampPct(nm),
      color: 'currentColor',
      isMajor: false,
    })),
  ];

  return lines.sort((a, b) => a.nm - b.nm);
}

/**
 * Generates symmetric Tokamak toroidal flux coils and radial poloidal field ribs.
 */
export function generateTokamakGeometry(cx = 300, cy = 300): {
  concentricRadii: number[];
  radialSpokes: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  outerCoils: Array<{ d: string }>;
} {
  const concentricRadii = [64, 88, 112, 136, 160, 184];
  const spokeCount = 16;
  const radialSpokes: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const outerCoils: Array<{ d: string }> = [];

  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    radialSpokes.push({
      x1: Number((cx + 56 * cos).toFixed(2)),
      y1: Number((cy + 56 * sin).toFixed(2)),
      x2: Number((cx + 194 * cos).toFixed(2)),
      y2: Number((cy + 194 * sin).toFixed(2)),
    });

    // Precision rectangular toroidal magnet coil shoes around perimeter
    const perpX = -sin;
    const perpY = cos;
    const halfW = 6;
    const rIn = 186;
    const rOut = 202;
    const p1x = cx + rIn * cos - halfW * perpX;
    const p1y = cy + rIn * sin - halfW * perpY;
    const p2x = cx + rOut * cos - halfW * perpX;
    const p2y = cy + rOut * sin - halfW * perpY;
    const p3x = cx + rOut * cos + halfW * perpX;
    const p3y = cy + rOut * sin + halfW * perpY;
    const p4x = cx + rIn * cos + halfW * perpX;
    const p4y = cy + rIn * sin + halfW * perpY;
    outerCoils.push({
      d: `M${p1x.toFixed(2)},${p1y.toFixed(2)} L${p2x.toFixed(2)},${p2y.toFixed(2)} L${p3x.toFixed(2)},${p3y.toFixed(2)} L${p4x.toFixed(2)},${p4y.toFixed(2)} Z`,
    });
  }

  return { concentricRadii, radialSpokes, outerCoils };
}

/**
 * Generates a mathematically plotted 5-fold twisted Stellarator ribbon knot
 * (inspired by Wendelstein 7-X 5-field-period modular geometry) plus 5 edge magnetic islands.
 */
export function generateStellaratorGeometry(cx = 300, cy = 300): {
  ribbons: Array<{ d: string; phaseIndex: number }>;
  islands: Array<{ d: string; cx: number; cy: number }>;
  coreAxis: string;
} {
  const folds = 5;
  const samples = 240;
  const baseRadius = 128;
  const ribbons: Array<{ d: string; phaseIndex: number }> = [];

  // 7 nested helical flux surfaces twisting through 5 field periods
  for (let layer = 0; layer < 7; layer++) {
    const phase = (layer / 7) * Math.PI * 2;
    const radialSpread = 22 + layer * 6.5;
    const cmds: string[] = [];

    for (let s = 0; s <= samples; s++) {
      const t = (s / samples) * Math.PI * 2;
      const twist = folds * t + phase;
      const r =
        baseRadius +
        radialSpread * Math.cos(twist) +
        14 * Math.sin(folds * t) +
        6 * Math.cos(2 * folds * t - phase * 0.5);
      const x = cx + r * Math.cos(t);
      const y = cy + r * Math.sin(t);
      cmds.push(`${s === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
    }
    cmds.push('Z');
    ribbons.push({ d: cmds.join(' '), phaseIndex: layer });
  }

  // Magnetic axis centerline
  const axisCmds: string[] = [];
  for (let s = 0; s <= samples; s++) {
    const t = (s / samples) * Math.PI * 2;
    const r = baseRadius + 14 * Math.sin(folds * t);
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    axisCmds.push(`${s === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  axisCmds.push('Z');

  // 5 edge magnetic islands positioned symmetrically at the 5 divertor lobes
  const islands: Array<{ d: string; cx: number; cy: number }> = [];
  for (let k = 0; k < folds; k++) {
    const phi = (k / folds) * Math.PI * 2 + Math.PI / (2 * folds);
    const lobeRadius = 186;
    const icx = cx + lobeRadius * Math.cos(phi);
    const icy = cy + lobeRadius * Math.sin(phi);
    const islandCmds: string[] = [];
    const islandSamples = 40;
    for (let s = 0; s <= islandSamples; s++) {
      const a = (s / islandSamples) * Math.PI * 2;
      // Tangent-aligned almond/island shape
      const localX = 24 * Math.cos(a);
      const localY = 9 * Math.sin(a) * (1 + 0.18 * Math.cos(a));
      const rot = phi + Math.PI / 2;
      const px = icx + localX * Math.cos(rot) - localY * Math.sin(rot);
      const py = icy + localX * Math.sin(rot) + localY * Math.cos(rot);
      islandCmds.push(`${s === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`);
    }
    islandCmds.push('Z');
    islands.push({
      d: islandCmds.join(' '),
      cx: Number(icx.toFixed(2)),
      cy: Number(icy.toFixed(2)),
    });
  }

  return {
    ribbons,
    islands,
    coreAxis: axisCmds.join(' '),
  };
}

/**
 * Generates a circular SVG path for <textPath> ring text.
 */
export function generateCirclePath(cx: number, cy: number, r: number): string {
  return `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx - 0.01},${cy - r}`;
}

/**
 * Converts a polar angle (degrees, 0 at 12 o'clock, clockwise) to Cartesian coordinates.
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): PolarPoint {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: Number((cx + radius * Math.cos(rad)).toFixed(2)),
    y: Number((cy + radius * Math.sin(rad)).toFixed(2)),
  };
}

/**
 * Generates 60 radial precision degree tick marks around a Swiss instrument dial.
 */
export function generateDialTicks(
  cx = 150,
  cy = 150,
  outerRadius = 132,
  count = 60
): DialTick[] {
  const ticks: DialTick[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 360;
    const isMajor = i % 5 === 0;
    const innerRadius = isMajor ? outerRadius - 14 : outerRadius - 7;
    const p1 = polarToCartesian(cx, cy, innerRadius, angle);
    const p2 = polarToCartesian(cx, cy, outerRadius, angle);
    ticks.push({
      index: i,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      isMajor,
    });
  }
  return ticks;
}

/**
 * Builds an SVG arc path starting at 12 o'clock (0 deg) sweeping clockwise by progress (0..1).
 */
export function generateDialArcPath(
  cx: number,
  cy: number,
  radius: number,
  progress: number
): string {
  const clamped = Math.max(0.001, Math.min(0.999, progress));
  const endAngle = clamped * 360;
  const start = polarToCartesian(cx, cy, radius, 0);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}
