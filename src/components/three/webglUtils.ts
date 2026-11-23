import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let cachedIsSoftwareGl: boolean | null = null;

/**
 * Detects software WebGL rasterizers (SwiftShader, llvmpipe, softpipe) once
 * so we can scale pixelRatio / antialiasing / frame pacing cleanly without
 * changing scene geometry, lighting, or layout.
 */
export function detectSoftwareWebGL(): boolean {
  if (cachedIsSoftwareGl !== null) return cachedIsSoftwareGl;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl =
      probeCanvas.getContext('webgl2') ||
      probeCanvas.getContext('webgl') ||
      probeCanvas.getContext('experimental-webgl');
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const debugInfo = (gl as WebGLRenderingContext).getExtension(
      'WEBGL_debug_renderer_info'
    );
    const rendererStr = debugInfo
      ? String(
          (gl as WebGLRenderingContext).getParameter(
            debugInfo.UNMASKED_RENDERER_WEBGL
          ) || ''
        )
      : String(
          (gl as WebGLRenderingContext).getParameter(
            (gl as WebGLRenderingContext).RENDERER
          ) || ''
        );
    cachedIsSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
      rendererStr
    );
    const loseExt = (gl as WebGLRenderingContext).getExtension(
      'WEBGL_lose_context'
    );
    loseExt?.loseContext();
  } catch {
    cachedIsSoftwareGl = false;
  }
  return cachedIsSoftwareGl;
}

export interface SculpturalRendererBundle {
  renderer: THREE.WebGLRenderer;
  envRT: THREE.WebGLRenderTarget;
  isSoftwareGl: boolean;
}

/**
 * Creates a transparent, ACES-tone-mapped WebGLRenderer + RoomEnvironment PMREM
 * studio reflection map so metallic coils and gimbal rings catch crisp highlights.
 */
export function createSculpturalRenderer(
  container: HTMLElement
): SculpturalRendererBundle | null {
  const isSoftwareGl = detectSoftwareWebGL();
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    });
  } catch {
    return null;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(
    isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75)
  );

  const w = Math.max(1, container.clientWidth);
  const h = Math.max(1, container.clientHeight);
  renderer.setSize(w, h, false);

  const canvas = renderer.domElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';
  container.appendChild(canvas);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRT = pmrem.fromScene(roomEnv, 0.04);
  roomEnv.dispose();
  pmrem.dispose();

  return { renderer, envRT, isSoftwareGl };
}

/**
 * GPU-friendly rAF loop with automatic fence-paced cooldown on software WebGL
 * so headless browsers never stall the main thread.
 */
export function createAdaptiveLoop(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
  onFrame: (now: number) => void
): { start: () => void; stop: () => void } {
  let stopped = false;
  let rafId = 0;
  let timerId = 0;

  const scheduleNext = () => {
    if (stopped) return;
    if (!isSoftwareGl) {
      rafId = window.requestAnimationFrame(step);
      return;
    }

    const gl = renderer.getContext();
    const waitFence = () => {
      if (stopped) return;
      timerId = window.setTimeout(() => {
        if (!stopped) {
          rafId = window.requestAnimationFrame(step);
        }
      }, 75);
    };

    if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (sync) {
        gl.flush();
        const poll = () => {
          if (stopped) {
            gl.deleteSync(sync);
            return;
          }
          const status = gl.clientWaitSync(sync, 0, 0);
          if (
            status === gl.ALREADY_SIGNALED ||
            status === gl.CONDITION_SATISFIED ||
            status === gl.WAIT_FAILED
          ) {
            gl.deleteSync(sync);
            waitFence();
          } else {
            timerId = window.setTimeout(poll, 16);
          }
        };
        timerId = window.setTimeout(poll, 12);
        return;
      }
    }
    waitFence();
  };

  const step = (now: number) => {
    if (stopped) return;
    onFrame(now);
    scheduleNext();
  };

  return {
    start() {
      stopped = false;
      rafId = window.requestAnimationFrame(step);
    },
    stop() {
      stopped = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timerId) window.clearTimeout(timerId);
    },
  };
}

/**
 * Cleanly disposes all geometries, materials, textures, PMREM targets, and the WebGL context.
 */
export function disposeThreeBundle(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  envRT: THREE.WebGLRenderTarget
): void {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const m of mats) {
        m.dispose();
      }
    }
  });
  scene.environment = null;
  envRT.dispose();
  renderer.dispose();
  if (renderer.domElement.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
}

export interface MergedClosedTubesBuffer {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  normals: Float32Array;
  tubeCount: number;
  ringSteps: number;
  radialSides: number;
}

/**
 * Pre-allocates a single merged BufferGeometry for `tubeCount` closed 3D tubes
 * so all coils or magnetic island loops render in ONE single draw call and
 * update smoothly in-place with zero per-frame allocations.
 */
export function createMergedClosedTubesBuffer(
  tubeCount: number,
  ringSteps: number,
  radialSides: number
): MergedClosedTubesBuffer {
  const vertsPerTube = (ringSteps + 1) * (radialSides + 1);
  const totalVerts = tubeCount * vertsPerTube;
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  const indicesPerTube = ringSteps * radialSides * 6;
  const indices =
    totalVerts > 65535
      ? new Uint32Array(tubeCount * indicesPerTube)
      : new Uint16Array(tubeCount * indicesPerTube);

  let uvPtr = 0;
  let idxPtr = 0;
  for (let t = 0; t < tubeCount; t++) {
    const baseV = t * vertsPerTube;
    for (let i = 0; i <= ringSteps; i++) {
      const u = i / ringSteps;
      for (let j = 0; j <= radialSides; j++) {
        uvs[uvPtr++] = u;
        uvs[uvPtr++] = j / radialSides;
      }
    }
    for (let i = 0; i < ringSteps; i++) {
      for (let j = 0; j < radialSides; j++) {
        const a = baseV + i * (radialSides + 1) + j;
        const b = baseV + (i + 1) * (radialSides + 1) + j;
        const c = baseV + (i + 1) * (radialSides + 1) + (j + 1);
        const d = baseV + i * (radialSides + 1) + (j + 1);
        indices[idxPtr++] = a;
        indices[idxPtr++] = b;
        indices[idxPtr++] = d;
        indices[idxPtr++] = b;
        indices[idxPtr++] = c;
        indices[idxPtr++] = d;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  return { geometry, positions, normals, tubeCount, ringSteps, radialSides };
}

// Reusable scratch buffers for zero-GC in-place tube sweeps
const _centerPointsX = new Float32Array(128);
const _centerPointsY = new Float32Array(128);
const _centerPointsZ = new Float32Array(128);

/**
 * Updates a MergedClosedTubesBuffer in-place using a smooth Frenet/parallel frame.
 */
export function updateMergedClosedTubesInPlace(
  buf: MergedClosedTubesBuffer,
  radius: number,
  samplePoint: (
    tubeIdx: number,
    theta: number,
    out: { x: number; y: number; z: number }
  ) => void
): void {
  const { positions, normals, tubeCount, ringSteps, radialSides } = buf;
  const vertsPerTube = (ringSteps + 1) * (radialSides + 1);
  const pt = { x: 0, y: 0, z: 0 };

  for (let t = 0; t < tubeCount; t++) {
    // 1. Sample centerline loop
    for (let i = 0; i < ringSteps; i++) {
      const theta = (i / ringSteps) * Math.PI * 2;
      samplePoint(t, theta, pt);
      _centerPointsX[i] = pt.x;
      _centerPointsY[i] = pt.y;
      _centerPointsZ[i] = pt.z;
    }

    const baseV = t * vertsPerTube;
    for (let i = 0; i <= ringSteps; i++) {
      const idx = i % ringSteps;
      const prevIdx = (idx - 1 + ringSteps) % ringSteps;
      const nextIdx = (idx + 1) % ringSteps;

      const cx = _centerPointsX[idx];
      const cy = _centerPointsY[idx];
      const cz = _centerPointsZ[idx];

      // Tangent T
      let tx = _centerPointsX[nextIdx] - _centerPointsX[prevIdx];
      let ty = _centerPointsY[nextIdx] - _centerPointsY[prevIdx];
      let tz = _centerPointsZ[nextIdx] - _centerPointsZ[prevIdx];
      const tLen = Math.hypot(tx, ty, tz) || 1;
      tx /= tLen;
      ty /= tLen;
      tz /= tLen;

      // Stable radial reference from origin to build orthogonal frame (N, B)
      let rx = cx;
      let ry = cy;
      let rz = cz;
      const rDotT = rx * tx + ry * ty + rz * tz;
      rx -= rDotT * tx;
      ry -= rDotT * ty;
      rz -= rDotT * tz;
      let rLen = Math.hypot(rx, ry, rz);
      if (rLen < 1e-4) {
        rx = Math.abs(ty) < 0.9 ? 0 : 1;
        ry = Math.abs(ty) < 0.9 ? 1 : 0;
        rz = 0;
        const d2 = rx * tx + ry * ty + rz * tz;
        rx -= d2 * tx;
        ry -= d2 * ty;
        rz -= d2 * tz;
        rLen = Math.hypot(rx, ry, rz) || 1;
      }
      const nx = rx / rLen;
      const ny = ry / rLen;
      const nz = rz / rLen;

      // Binormal B = T x N
      const bx = ty * nz - tz * ny;
      const by = tz * nx - tx * nz;
      const bz = tx * ny - ty * nx;

      for (let j = 0; j <= radialSides; j++) {
        const ang = (j / radialSides) * Math.PI * 2;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);

        const dnx = nx * ca + bx * sa;
        const dny = ny * ca + by * sa;
        const dnz = nz * ca + bz * sa;

        const vIdx = (baseV + i * (radialSides + 1) + j) * 3;
        positions[vIdx] = cx + dnx * radius;
        positions[vIdx + 1] = cy + dny * radius;
        positions[vIdx + 2] = cz + dnz * radius;

        normals[vIdx] = dnx;
        normals[vIdx + 1] = dny;
        normals[vIdx + 2] = dnz;
      }
    }
  }

  buf.geometry.attributes.position.needsUpdate = true;
  buf.geometry.attributes.normal.needsUpdate = true;
  buf.geometry.computeBoundingSphere();
}

/**
 * Compact, self-contained Ashima 3D Simplex Noise GLSL chunk for procedural MHD plasma shaders.
 */
export const GLSL_SIMPLEX_3D = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;
