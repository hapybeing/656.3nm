import { clamp } from './motionMath';

export const MU_0 = 4 * Math.PI * 1e-7;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedPoint {
  sx: number;
  sy: number;
  depth: number;
  alpha: number;
}

export interface CagePhysicsParams {
  morphT: number; // 0 = Tokamak, 1 = 5-fold Stellarator
  bFieldTesla: number; // 0.0 -> 20.0 T
  timeSec: number;
  radialScale?: number;
}

export interface HeadlinePinchState {
  wdth: number;
  wght: number;
  letterSpacingEm: number;
  ringAngularSpeedRad: number;
  isDisrupted: boolean;
  disruptionFactor: number;
}

/**
 * True magnetic pressure P_B = B^2 / (2 * mu_0) converted to MegaPascals (MPa).
 * 12.0 T => ~57.3 MPa, 20.0 T => ~159.2 MPa.
 */
export function computeMagneticPressureMPa(bFieldTesla: number): number {
  const b = Math.max(0, bFieldTesla);
  const pascals = (b * b) / (2 * MU_0);
  return Number((pascals / 1e6).toFixed(1));
}

/**
 * Returns 0..1 MHD kink disruption intensity when B-field drops below 3.0 T.
 */
export function computeDisruptionFactor(bFieldTesla: number): number {
  if (bFieldTesla >= 3.0) return 0;
  return Number(clamp((3.0 - bFieldTesla) / 3.0, 0, 1).toFixed(3));
}

/**
 * Couples Tesla field strength (0..20 T) to Bricolage Grotesque headline pinch & ring velocity.
 */
export function computeHeadlinePinch(bFieldTesla: number): HeadlinePinchState {
  const b = clamp(bFieldTesla, 0, 20);
  const norm = b / 20;
  const disruptionFactor = computeDisruptionFactor(b);
  const isDisrupted = b < 3.0;

  let wdth = 100 - 25 * norm; // 100 -> 75
  let wght: number;
  if (isDisrupted) {
    // Drop smoothly down to 350 under confinement loss
    const t = b / 3.0;
    wght = 350 + 180 * t;
  } else if (b < 12.0) {
    const t = (b - 3.0) / 9.0;
    wght = 530 + 90 * t; // 530 -> 620
  } else {
    const t = (b - 12.0) / 8.0;
    wght = 620 + 180 * t; // 620 -> 800
  }

  const letterSpacingEm = -0.02 - 0.04 * norm; // -0.02em -> -0.06em
  const ringAngularSpeedRad = 0.07 + 0.48 * norm;

  return {
    wdth: Number(wdth.toFixed(1)),
    wght: Number(wght.toFixed(1)),
    letterSpacingEm: Number(letterSpacingEm.toFixed(4)),
    ringAngularSpeedRad: Number(ringAngularSpeedRad.toFixed(3)),
    isDisrupted,
    disruptionFactor,
  };
}

/**
 * Evaluates the 3D magnetic axis curve at toroidal angle phi, continuously morphing
 * from a planar Tokamak circle (morphT = 0) to a 5-fold helical Stellarator axis (morphT = 1),
 * plus chaotic m=2/n=1 kink displacement when B < 3.0 T.
 */
export function evaluateMagneticAxisPoint(
  phi: number,
  params: CagePhysicsParams
): Vec3 {
  const m = clamp(params.morphT, 0, 1);
  const disruption = computeDisruptionFactor(params.bFieldTesla);
  const r0 = 1.62;

  const axisR = r0 + m * 0.25 * Math.cos(5 * phi);
  const axisZ = m * 0.26 * Math.sin(5 * phi);

  // Kink instability shakes the magnetic axis violently below 3.0 T
  let kinkR = 0;
  let kinkZ = 0;
  if (disruption > 0.001) {
    const t = params.timeSec;
    kinkR =
      disruption *
      (0.24 * Math.sin(phi - t * 10.5) + 0.14 * Math.cos(2 * phi + t * 16.0));
    kinkZ =
      disruption *
      (0.22 * Math.cos(phi + t * 11.8) + 0.12 * Math.sin(3 * phi - t * 14.2));
  }

  const finalR = axisR + kinkR;
  const finalZ = axisZ + kinkZ;
  return {
    x: finalR * Math.cos(phi),
    y: finalZ,
    z: finalR * Math.sin(phi),
  };
}

/**
 * Continuous 3D parametric confinement surface morphing seamlessly between:
 * - morphT = 0: Axisymmetric Miller D-shaped Tokamak (delta = 0.42, kappa = 1.55)
 * - morphT = 1: Wendelstein 7-X 5-fold twisted Stellarator (N = 5 periods, rotating
 *   bean <-> triangular cross-section + helical axis excursion)
 * Coupled live to Tesla magnetic pinch compression & <3T MHD kink instability.
 */
export function evaluatePlasmaSurfacePoint(
  phi: number,
  theta: number,
  params: CagePhysicsParams
): Vec3 {
  const m = clamp(params.morphT, 0, 1);
  const bNorm = clamp(params.bFieldTesla, 0, 20) / 20;
  const disruption = computeDisruptionFactor(params.bFieldTesla);
  const radialScale = params.radialScale ?? 1;

  // Magnetic pinch physically compresses minor radius a as B rises 0 -> 20 T
  const pinchFactor = 1.15 - 0.38 * bNorm;
  const a = 0.56 * pinchFactor * radialScale;
  const r0 = 1.62;

  // --- Tokamak axisymmetric Miller D-section ---
  const tokR = a * Math.cos(theta + 0.42 * Math.sin(theta));
  const tokZ = 1.55 * a * Math.sin(theta);

  // --- Stellarator W7-X 5-fold twisted bean <-> triangular cross-section ---
  const nPeriods = 5;
  const cos5 = Math.cos(nPeriods * phi);
  const sin5 = Math.sin(nPeriods * phi);
  const beanWeight = 0.5 * (1 + cos5); // 1 at phi = 0, 0 at phi = pi/5
  const triWeight = 1 - beanWeight;

  // Local unrotated cross-section combining concave bean indentation & sharp triangularity
  const beanIndent = -0.26 * beanWeight * Math.cos(2 * theta);
  const triLobe = 0.22 * triWeight * Math.cos(3 * theta);
  const u = a * (0.78 * Math.cos(theta) + beanIndent + triLobe);
  const v = a * (1.42 * Math.sin(theta) + 0.14 * beanWeight * Math.sin(2 * theta));

  // Rotate cross-section continuously by N * phi / 2
  const twistAngle = (nPeriods * phi) * 0.5;
  const cosTw = Math.cos(twistAngle);
  const sinTw = Math.sin(twistAngle);
  const stelR = u * cosTw - v * sinTw;
  const stelZ = u * sinTw + v * cosTw;

  // Morph cross-section & helical axis continuously
  let localR = tokR * (1 - m) + stelR * m;
  let localZ = tokZ * (1 - m) + stelZ * m;

  // MHD m=2, n=1 kink instability buckling when B < 3.0 T
  if (disruption > 0.001) {
    const t = params.timeSec;
    const kinkWave =
      0.32 * Math.sin(2 * theta - phi + t * 11.5) +
      0.18 * Math.cos(theta + 2 * phi - t * 15.2);
    const radialBuckle = 1 + disruption * kinkWave;
    localR = localR * radialBuckle + disruption * 0.18 * Math.sin(phi - t * 9.5);
    localZ = localZ * radialBuckle + disruption * 0.18 * Math.cos(phi + t * 10.2);
  }

  const axisR = r0 + m * 0.25 * cos5;
  const axisZ = m * 0.26 * sin5;

  const R = axisR + localR;
  const Z = axisZ + localZ;

  return {
    x: R * Math.cos(phi),
    y: Z,
    z: R * Math.sin(phi),
  };
}

/**
 * Evaluates a point along one of the 18 superconducting field coils, morphing from
 * planar D-shaped Tokamak toroidal coils (morphT = 0) into twisted 3D non-planar
 * modular Stellarator coils (morphT = 1).
 */
export function evaluateModularCoilPoint(
  coilIndex: number,
  totalCoils: number,
  theta: number,
  params: CagePhysicsParams
): Vec3 {
  const m = clamp(params.morphT, 0, 1);
  const phiBase = (coilIndex / totalCoils) * Math.PI * 2;
  // Non-planar 3D saddle warp on modular Stellarator coils
  const saddleWarp = m * 0.16 * Math.sin(2 * theta + 5 * phiBase);
  const phi = phiBase + saddleWarp;

  // Coils remain mechanically rigid (do not pinch with plasma minor radius)
  const rigidParams: CagePhysicsParams = {
    morphT: m,
    bFieldTesla: 10, // constant structural magnet frame
    timeSec: params.timeSec,
    radialScale: 1.38,
  };
  return evaluatePlasmaSurfacePoint(phi, theta, rigidParams);
}

/**
 * Evaluates one of the 5 distinct Wendelstein 7-X edge magnetic island chains
 * orbiting the separatrix in Stellarator mode.
 */
export function evaluateMagneticIslandPoint(
  islandIndex: number,
  phi: number,
  localAngle: number,
  params: CagePhysicsParams
): Vec3 {
  const m = clamp(params.morphT, 0, 1);
  const bNorm = clamp(params.bFieldTesla, 0, 20) / 20;
  const pinchFactor = 1.15 - 0.38 * bNorm;
  const r0 = 1.62;
  const nPeriods = 5;

  // Resonant 5/5 island center rotates along the 5-fold outer separatrix lobes
  const baseTheta = (islandIndex / 5) * Math.PI * 2 + phi * 1.0;
  const separatrixA = 0.72 * pinchFactor;

  const axisR = r0 + m * 0.25 * Math.cos(nPeriods * phi);
  const axisZ = m * 0.26 * Math.sin(nPeriods * phi);

  const twistAngle = (nPeriods * phi) * 0.5;
  const cosTw = Math.cos(twistAngle);
  const sinTw = Math.sin(twistAngle);

  // Small elliptical magnetic island O-point cross-section
  const islandU = separatrixA * Math.cos(baseTheta) + 0.085 * Math.cos(localAngle);
  const islandV = separatrixA * 1.35 * Math.sin(baseTheta) + 0.045 * Math.sin(localAngle);

  const localR = islandU * cosTw - islandV * sinTw;
  const localZ = islandU * sinTw + islandV * cosTw;

  const R = axisR + localR;
  const Z = axisZ + localZ;

  return {
    x: R * Math.cos(phi),
    y: Z,
    z: R * Math.sin(phi),
  };
}

/**
 * Projects a 3D Cartesian coordinate into 2D screen space with yaw (rotY), pitch (rotX),
 * perspective foreshortening, and calibrated depth alpha [0.14..0.95].
 */
export function projectPoint3D(
  p: Vec3,
  rotY: number,
  rotX: number,
  scale: number,
  cx: number,
  cy: number,
  cameraDist = 6.4
): ProjectedPoint {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = p.x * cosY + p.z * sinY;
  const z1 = -p.x * sinY + p.z * cosY;

  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = p.y * cosX - z1 * sinX;
  const z2 = p.y * sinX + z1 * cosX;

  const perspective = cameraDist / Math.max(1.2, cameraDist - z2);
  const sx = cx + x1 * scale * perspective;
  const sy = cy - y2 * scale * perspective;

  // Normalize depth z2 roughly in [-2.6, 2.6] -> alpha in [0.14, 0.95]
  const depth01 = clamp((z2 + 2.4) / 4.8, 0, 1);
  const alpha = 0.14 + 0.81 * depth01;

  return { sx, sy, depth: z2, alpha };
}
