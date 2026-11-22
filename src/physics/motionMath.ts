export interface SpringState {
  pos: number;
  vel: number;
}

export interface DopplerVars {
  slnt: number;
  chromaPx: number;
}

export interface FluxBaseVertex {
  theta: number;
  x0: number;
  y0: number;
  nx: number;
  ny: number;
}

export interface FluxBaseRing {
  index: number;
  tRadial: number;
  stroke: string;
  baseOpacity: number;
  vertices: FluxBaseVertex[];
}

export interface CharFieldTargets {
  wght: number;
  wdth: number;
  opsz: number;
  y: number;
  rot: number;
  chroma: number;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Critically/under-damped discrete spring step normalized to 60fps (dtFactor = dtMs / 16.6667).
 * Uses position + velocity per node so characters snap back with physical overshoot.
 */
export function stepSpring(
  state: SpringState,
  target: number,
  stiffness = 0.14,
  damping = 0.72,
  dtFactor = 1
): SpringState {
  const dt = clamp(dtFactor, 0.25, 2.0);
  const force = (target - state.pos) * stiffness * dt;
  const nextVel = (state.vel + force) * Math.pow(damping, dt);
  const nextPos = state.pos + nextVel * dt;
  state.vel = nextVel;
  state.pos = nextPos;
  return state;
}

/**
 * Computes Doppler scroll-velocity typography shear and chromatic dispersion.
 * Snaps cleanly to exact 0 at low velocity so resting typography is razor-sharp.
 */
export function computeDopplerVars(smoothVel: number): DopplerVars {
  if (Math.abs(smoothVel) < 0.06) {
    return { slnt: 0, chromaPx: 0 };
  }
  const slnt = clamp(-Math.abs(smoothVel) * 0.32, -10, 0);
  const chromaPx = clamp(smoothVel * 0.18, -7, 7);
  return {
    slnt: Number(slnt.toFixed(3)),
    chromaPx: Number(chromaPx.toFixed(3)),
  };
}

/**
 * Precomputes the 14 nested Miller D-shaped equilibrium flux surfaces at 80 vertices
 * per ring, including exact unit outward normals (nx, ny) for real-time MHD harmonics
 * and elastic Lorentz deflection.
 */
export function precomputeFluxEquilibrium(options?: {
  count?: number;
  cx?: number;
  cy?: number;
  maxMinorRadius?: number;
  delta?: number;
  kappa?: number;
  samples?: number;
}): FluxBaseRing[] {
  const count = options?.count ?? 14;
  const cx = options?.cx ?? 520;
  const cy = options?.cy ?? 450;
  const maxMinorRadius = options?.maxMinorRadius ?? 218;
  const delta = options?.delta ?? 0.45;
  const kappa = options?.kappa ?? 1.65;
  const samples = options?.samples ?? 80;

  const rings: FluxBaseRing[] = [];

  for (let i = 0; i < count; i++) {
    const t = (i + 1) / count;
    const shafranovShift = (1 - t * t) * 42;
    const r0 = cx + shafranovShift;
    const a = maxMinorRadius * (0.14 + 0.86 * t);
    const localDelta = delta * (0.55 + 0.45 * t);
    const localKappa = 1.28 + (kappa - 1.28) * t;

    const vertices: FluxBaseVertex[] = [];
    for (let s = 0; s < samples; s++) {
      const theta = (s / samples) * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const arg = theta + localDelta * sinT;
      const x0 = r0 + a * Math.cos(arg);
      const y0 = cy + localKappa * a * sinT;

      // Analytical tangent dR/dtheta, dZ/dtheta -> outward unit normal
      const dArg = 1 + localDelta * cosT;
      const tx = -a * Math.sin(arg) * dArg;
      const ty = localKappa * a * cosT;
      // Outward normal for clockwise/screen-Y-down curve: (ty, -tx)
      const len = Math.hypot(tx, ty) || 1;
      const nx = ty / len;
      const ny = -tx / len;

      vertices.push({ theta, x0, y0, nx, ny });
    }

    let stroke = '#111114';
    let baseOpacity = 0.22;
    if (i % 3 === 0) {
      stroke = '#FF1F71';
      baseOpacity = 0.72 + (1 - t) * 0.28;
    } else if (i % 3 === 1) {
      stroke = '#00D8FF';
      baseOpacity = 0.65 + (1 - t) * 0.25;
    } else {
      stroke = '#111114';
      baseOpacity = 0.16 + t * 0.12;
    }

    rings.push({
      index: i,
      tRadial: t,
      stroke,
      baseOpacity: Number(baseOpacity.toFixed(3)),
      vertices,
    });
  }

  return rings;
}

/**
 * Evaluates a live deformed MHD flux ring SVG path string + local magnetic pressure
 * from counter-rotating m=2 / m=3 poloidal waves and elastic Lorentz pointer deflection.
 */
export function evaluateMhdRingPath(
  ring: FluxBaseRing,
  timeSec: number,
  pointerSvgX: number,
  pointerSvgY: number,
  pointerStrength: number
): { d: string; strokeWidth: number } {
  const verts = ring.vertices;
  const n = verts.length;
  const radialScale = Math.pow(ring.tRadial, 1.35);

  // MHD harmonic amplitudes: calm near invisible core, visibly alive along outer shells
  const ampM2 = (2.2 + 9.5 * radialScale);
  const ampM3 = (1.4 + 6.2 * radialScale);
  const phase2 = -timeSec * 2.05 + ring.index * 0.36;
  const phase3 = timeSec * 1.55 - ring.index * 0.24;

  // Lorentz Gaussian repulsion parameters
  const maxDeflect = 38 * (0.45 + 0.55 * ring.tRadial) * pointerStrength;
  const invTwoSigmaSq = 1 / (2 * 138 * 138);

  let maxPressure = 0;
  let path = '';

  for (let s = 0; s < n; s++) {
    const v = verts[s];
    const mhdWave =
      ampM2 * Math.sin(2 * v.theta + phase2) +
      ampM3 * Math.sin(3 * v.theta + phase3);

    let dx = v.nx * mhdWave;
    let dy = v.ny * mhdWave;

    if (pointerStrength > 0.002) {
      const vx = v.x0 - pointerSvgX;
      const vy = v.y0 - pointerSvgY;
      const distSq = vx * vx + vy * vy;
      if (distSq < 380 * 380) {
        const gauss = Math.exp(-distSq * invTwoSigmaSq);
        if (gauss > maxPressure) {
          maxPressure = gauss;
        }
        // Smooth radial vector (softened at dist -> 0 to guarantee C-infinity continuity)
        const softDist = Math.sqrt(distSq + 225);
        const rx = vx / softDist;
        const ry = vy / softDist;
        const push = maxDeflect * gauss;
        // Smooth blend: 65% outward local normal expansion + 35% radial magnetic repulsion
        dx += (v.nx * 0.65 + rx * 0.35) * push;
        dy += (v.ny * 0.65 + ry * 0.35) * push;
      }
    }

    const fx = (v.x0 + dx).toFixed(1);
    const fy = (v.y0 + dy).toFixed(1);
    path += s === 0 ? `M${fx},${fy}` : `L${fx},${fy}`;
  }

  path += 'Z';
  const strokeWidth = Number(
    (1.4 + 1.2 * maxPressure * pointerStrength * (0.55 + 0.45 * ring.tRadial)).toFixed(2)
  );

  return { d: path, strokeWidth };
}

/**
 * Computes variable-font spring target values for a single Act 1 glyph given pointer
 * proximity (radius 230px) and subtle diagonal idle wave (0.38 Hz).
 */
export function computeCharFieldTargets(params: {
  charX: number;
  charY: number;
  pointerX: number;
  pointerY: number;
  pointerStrength: number;
  idleStrength: number;
  timeSec: number;
  radius?: number;
}): CharFieldTargets {
  const radius = params.radius ?? 230;

  // Base resting Swiss poster ink
  let wght = 800;
  let wdth = 92;
  let opsz = 96;
  let y = 0;
  let rot = 0;
  let chroma = 0;

  // Subtle diagonal traveling wave (0.38 Hz) when pointer is idle
  if (params.idleStrength > 0.001) {
    const wavePhase =
      params.timeSec * Math.PI * 2 * 0.38 -
      (params.charX * 0.0042 + params.charY * 0.003);
    const wave01 = 0.5 + 0.5 * Math.sin(wavePhase);
    const blend = params.idleStrength;
    wght -= 240 * wave01 * blend; // 800 <-> 560
    y -= 3 * wave01 * blend;
  }

  // Pointer / Touch Magnetic Ionization Field (radius 230px)
  if (params.pointerStrength > 0.001) {
    const dx = params.charX - params.pointerX;
    const dy = params.charY - params.pointerY;
    const dist = Math.hypot(dx, dy);
    if (dist < radius) {
      const linear = 1 - dist / radius;
      // Smooth cubic falloff for snappy edge & deep ionized center
      const prox = linear * linear * (3 - 2 * linear) * params.pointerStrength;

      wght = wght * (1 - prox) + 220 * prox;
      wdth = wdth * (1 - prox) + 75 * prox;
      opsz = opsz * (1 - prox) + 12 * prox;
      y = y * (1 - prox) - 11 * prox;
      rot = clamp((dx / radius) * 5.2 * prox, -3, 3);
      chroma = 3 * prox;
    }
  }

  return { wght, wdth, opsz, y, rot, chroma };
}
