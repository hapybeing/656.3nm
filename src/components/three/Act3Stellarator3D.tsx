import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  evaluateMagneticAxisPoint,
  evaluateMagneticIslandPoint,
  evaluateModularCoilPoint,
  evaluatePlasmaSurfacePoint,
  type CagePhysicsParams,
} from '../../physics/cage3dMath';
import {
  createAdaptiveLoop,
  createMergedClosedTubesBuffer,
  createSculpturalRenderer,
  disposeThreeBundle,
  GLSL_SIMPLEX_3D,
  updateMergedClosedTubesInPlace,
  useViewportWebGLActive,
} from './webglUtils';

export interface Act3VisualState {
  morphT: number;
  bField: number;
  rotY: number;
  rotX: number;
  disruptionFactor: number;
}

export interface Act3Stellarator3DProps {
  stateRef: React.MutableRefObject<Act3VisualState>;
  ariaLabel: string;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  className?: string;
}

const PHI_STEPS = 120;
const THETA_STEPS = 32;
const COIL_COUNT = 14;
const COIL_RADIUS = 0.024;

const PLASMA_MANIFOLD_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const PLASMA_MANIFOLD_FRAG = /* glsl */ `
uniform float uTime;
uniform float uBFieldNorm;
uniform float uMorphT;
uniform float uDisruption;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

${GLSL_SIMPLEX_3D}

void main() {
  vec3 N = normalize(vWorldNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 2.0);
  float rim = pow(1.0 - ndotv, 3.5);

  float qFactor = 3.1 + uBFieldNorm * 0.65;
  float speed = 1.6 + uBFieldNorm * 3.8;
  float warp = snoise(vWorldPos * 1.65 + vec3(uTime * 0.6, -uTime * 0.45, uTime * 0.35));

  // Relativistic helical plasma filaments winding along field lines (q = 3.1..3.75)
  float phi = vUv.x * 6.2831853;
  float theta = vUv.y * 6.2831853;
  float helicalA = 0.5 + 0.5 * sin(8.0 * (theta - phi * qFactor) - uTime * speed + warp * 1.9);
  float helicalB = 0.5 + 0.5 * cos(5.0 * (theta - phi * (qFactor * 0.8)) + uTime * speed * 0.72 + warp * 1.4);

  float filamentYellow = smoothstep(0.46, 0.94, helicalA);
  float filamentCyan   = smoothstep(0.50, 0.95, helicalB);
  float filamentPink   = smoothstep(0.68, 0.97, 0.5 + 0.5 * sin(12.0 * phi - 3.0 * theta - uTime * speed * 1.4));

  vec3 acidYellow = vec3(0.918, 1.0, 0.169);   // #EAFF2B
  vec3 elecCyan   = vec3(0.0, 0.847, 1.0);     // #00D8FF
  vec3 balmerPink = vec3(1.0, 0.122, 0.443);   // #FF1F71
  vec3 crimson    = vec3(1.0, 0.165, 0.165);   // #FF2A2A
  vec3 deepIndigo = vec3(0.045, 0.075, 0.36);

  // Sharper Fresnel depth separation so the sculptural plasma core dominates the cobalt field
  float coreShade = 0.38 + 0.62 * pow(ndotv, 0.85);
  vec3 col = deepIndigo * coreShade;
  col = mix(col, elecCyan * 1.15, filamentCyan * 0.88);
  col = mix(col, acidYellow * 1.18, filamentYellow * 0.96);
  col += balmerPink * filamentPink * (0.95 + uMorphT * 0.55);
  col += mix(elecCyan, acidYellow, 0.58) * fresnel * 0.82;
  col += vec3(0.96, 0.98, 1.0) * rim * 1.15;

  // Violent crimson kink disruption takeover below 3.0 T
  if (uDisruption > 0.01) {
    float flicker = 0.75 + 0.25 * sin(uTime * 34.0 + warp * 6.0);
    vec3 disruptCol = mix(crimson, vec3(1.0, 0.96, 0.92), filamentYellow * 0.65);
    col = mix(col, disruptCol * flicker, clamp(uDisruption * 1.25, 0.0, 1.0));
  }

  // Crisp studio specular reflection
  vec3 L = normalize(vec3(4.0, 5.0, 4.5));
  float spec = pow(max(dot(N, normalize(L + V)), 0.0), 40.0);
  col += vec3(1.0) * spec * 0.72;

  float alpha = clamp(0.60 + fresnel * 0.38 + filamentYellow * 0.28 + filamentCyan * 0.22, 0.0, 0.98);
  gl_FragColor = vec4(col, alpha);
}
`;

function createManifoldGeometry(): {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
} {
  const vertCount = (PHI_STEPS + 1) * (THETA_STEPS + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = new Uint32Array(PHI_STEPS * THETA_STEPS * 6);

  let uPtr = 0;
  for (let i = 0; i <= PHI_STEPS; i++) {
    const u = i / PHI_STEPS;
    for (let j = 0; j <= THETA_STEPS; j++) {
      uvs[uPtr++] = u;
      uvs[uPtr++] = j / THETA_STEPS;
    }
  }

  let idxPtr = 0;
  for (let i = 0; i < PHI_STEPS; i++) {
    for (let j = 0; j < THETA_STEPS; j++) {
      const a = i * (THETA_STEPS + 1) + j;
      const b = (i + 1) * (THETA_STEPS + 1) + j;
      const c = (i + 1) * (THETA_STEPS + 1) + (j + 1);
      const d = i * (THETA_STEPS + 1) + (j + 1);
      indices[idxPtr++] = a;
      indices[idxPtr++] = b;
      indices[idxPtr++] = d;
      indices[idxPtr++] = b;
      indices[idxPtr++] = c;
      indices[idxPtr++] = d;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return { geometry, positions };
}

function updateManifoldPositions(
  geometry: THREE.BufferGeometry,
  positions: Float32Array,
  params: CagePhysicsParams
): void {
  let ptr = 0;
  for (let i = 0; i <= PHI_STEPS; i++) {
    const phi = (i / PHI_STEPS) * Math.PI * 2;
    for (let j = 0; j <= THETA_STEPS; j++) {
      const theta = (j / THETA_STEPS) * Math.PI * 2;
      const p = evaluatePlasmaSurfacePoint(phi, theta, params);
      positions[ptr++] = p.x;
      positions[ptr++] = p.y;
      positions[ptr++] = p.z;
    }
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

/**
 * ACT 03 — REAL SOLID 3D VERTEX-MORPHED TOKAMAK <-> WENDELSTEIN 7-X STELLARATOR
 * - 160x48 custom BufferGeometry plasma manifold morphing seamlessly in 3D space
 * - Custom GLSL relativistic helical filament shader (#EAFF2B, #00D8FF, #FF1F71, crimson kink <3T)
 * - 18 glossy metallic-silver/cobalt morphing modular coils (1 draw call, zero-GC updates)
 * - 5 glowing 3D helical magnetic island tubes blooming smoothly with morphT
 * - Hot #FF1F71 magnetic axis core tube
 * - Interactive drag-to-orbit with damped inertia + auto-orbit
 */
export const Act3Stellarator3D: React.FC<Act3Stellarator3DProps> = ({
  stateRef,
  ariaLabel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const isActive = useViewportWebGLActive(mountRef, false, '160px 0px 160px 0px');

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !isActive) return;

    const bundle = createSculpturalRenderer(container);
    if (!bundle) return;
    const { renderer, envRT, isSoftwareGl } = bundle;

    const scene = new THREE.Scene();
    scene.environment = envRT.texture;

    const camera = new THREE.PerspectiveCamera(
      38,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      50
    );
    camera.position.set(0, 0.3, 8.1);
    camera.lookAt(0, 0, 0);

    // Crisp studio lighting over Balmer Cobalt (#1822FF) catching sleek titanium ribs
    const keyLight = new THREE.DirectionalLight(0xf6f3eb, 2.8);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);

    const rimWhiteLight = new THREE.DirectionalLight(0xf6f3eb, 2.2);
    rimWhiteLight.position.set(-4.5, 3.0, -4.0);
    scene.add(rimWhiteLight);

    const cyanLight = new THREE.PointLight(0x00d8ff, 30, 18, 1.4);
    cyanLight.position.set(4.2, -2.0, 4.0);
    scene.add(cyanLight);

    const yellowLight = new THREE.PointLight(0xeaff2b, 20, 16, 1.5);
    yellowLight.position.set(-4.0, 2.6, 3.6);
    scene.add(yellowLight);

    const rig = new THREE.Group();
    scene.add(rig);

    // 1. Solid 3D Parametric Plasma Manifold (160x48)
    const manifold = createManifoldGeometry();
    const plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBFieldNorm: { value: 0.6 },
        uMorphT: { value: 0 },
        uDisruption: { value: 0 },
      },
      vertexShader: PLASMA_MANIFOLD_VERT,
      fragmentShader: PLASMA_MANIFOLD_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const plasmaMesh = new THREE.Mesh(manifold.geometry, plasmaMat);
    plasmaMesh.renderOrder = 2;
    rig.add(plasmaMesh);

    // 2. 14 Razor-Sleek Dark-Chrome / Titanium Superconducting Modular Coils (1 draw call)
    const coilBuf = createMergedClosedTubesBuffer(COIL_COUNT, 28, 6);
    const coilMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#283044'),
      emissive: new THREE.Color('#00D8FF'),
      emissiveIntensity: 0.14,
      metalness: 0.96,
      roughness: 0.12,
      envMapIntensity: 2.35,
    });
    const coilMesh = new THREE.Mesh(coilBuf.geometry, coilMat);
    coilMesh.renderOrder = 1;
    rig.add(coilMesh);

    // 3. 5 Glowing 3D Helical Magnetic Island Tubes (bloom with morphT)
    const islandBuf = createMergedClosedTubesBuffer(5, 48, 5);
    const islandMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#00D8FF'),
      emissive: new THREE.Color('#00D8FF'),
      emissiveIntensity: 1.35,
      metalness: 0.3,
      roughness: 0.25,
      transparent: true,
      opacity: 0,
    });
    const islandMesh = new THREE.Mesh(islandBuf.geometry, islandMat);
    islandMesh.visible = false;
    islandMesh.renderOrder = 3;
    rig.add(islandMesh);

    // 4. Hot #FF1F71 Core Magnetic Axis Filament Tube (1 closed tube)
    const axisBuf = createMergedClosedTubesBuffer(1, 72, 6);
    const axisMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#FF1F71'),
      emissive: new THREE.Color('#FF1F71'),
      emissiveIntensity: 1.8,
      metalness: 0.2,
      roughness: 0.2,
    });
    const axisMesh = new THREE.Mesh(axisBuf.geometry, axisMat);
    axisMesh.renderOrder = 3;
    rig.add(axisMesh);

    const colorPink = new THREE.Color('#FF1F71');
    const colorCrimson = new THREE.Color('#FF2A2A');

    // Reusable physics params object (zero per-frame allocation)
    const params: CagePhysicsParams = {
      morphT: stateRef.current.morphT,
      bFieldTesla: stateRef.current.bField,
      timeSec: 0,
    };

    // Initial synchronous geometry build
    updateManifoldPositions(manifold.geometry, manifold.positions, params);
    updateMergedClosedTubesInPlace(coilBuf, COIL_RADIUS, (c, theta, out) => {
      const p = evaluateModularCoilPoint(c, COIL_COUNT, theta, params);
      out.x = p.x;
      out.y = p.y;
      out.z = p.z;
    });
    updateMergedClosedTubesInPlace(axisBuf, 0.048, (_t, phi, out) => {
      const p = evaluateMagneticAxisPoint(phi, params);
      out.x = p.x;
      out.y = p.y;
      out.z = p.z;
    });

    let lastCoilMorph = params.morphT;
    let lastManifoldMorph = params.morphT;
    let lastManifoldB = params.bFieldTesla;
    let lastIslandMorph = -1;
    let lastIslandB = -1;

    let isVisible = true;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          isVisible = e.isIntersecting;
        }
      },
      { threshold: 0.01, rootMargin: '140px 0px 140px 0px' }
    );
    io.observe(container);

    const handleResize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    let lastTs = performance.now();
    let elapsed = 0;

    rig.rotation.order = 'XYZ';
    rig.rotation.x = stateRef.current.rotX;
    rig.rotation.y = stateRef.current.rotY;
    renderer.render(scene, camera);

    const loop = createAdaptiveLoop(renderer, isSoftwareGl, (now) => {
      if (!isVisible) {
        lastTs = now;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTs) * 0.001));
      lastTs = now;
      elapsed += dt;

      const st = stateRef.current;
      params.morphT = st.morphT;
      params.bFieldTesla = st.bField;
      params.timeSec = elapsed;

      const isDisrupted = st.disruptionFactor > 0.005;

      // Update plasma manifold only when morphT, bField, or kink disruption changes
      if (
        isDisrupted ||
        Math.abs(st.morphT - lastManifoldMorph) > 0.001 ||
        Math.abs(st.bField - lastManifoldB) > 0.015
      ) {
        lastManifoldMorph = st.morphT;
        lastManifoldB = st.bField;
        updateManifoldPositions(manifold.geometry, manifold.positions, params);

        updateMergedClosedTubesInPlace(axisBuf, isDisrupted ? 0.062 : 0.048, (_t, phi, out) => {
          const p = evaluateMagneticAxisPoint(phi, params);
          out.x = p.x;
          out.y = p.y;
          out.z = p.z;
        });
      }

      // Update 14 dark-titanium modular coils ONLY when morphT changes
      if (Math.abs(st.morphT - lastCoilMorph) > 0.001) {
        lastCoilMorph = st.morphT;
        updateMergedClosedTubesInPlace(coilBuf, COIL_RADIUS, (c, theta, out) => {
          const p = evaluateModularCoilPoint(c, COIL_COUNT, theta, params);
          out.x = p.x;
          out.y = p.y;
          out.z = p.z;
        });
      }

      // Update 5 glowing 3D helical magnetic island tubes when morphT > 0.03
      if (st.morphT > 0.03) {
        islandMesh.visible = true;
        islandMat.opacity = Math.min(0.95, st.morphT * 0.95);
        if (
          Math.abs(st.morphT - lastIslandMorph) > 0.002 ||
          Math.abs(st.bField - lastIslandB) > 0.02
        ) {
          lastIslandMorph = st.morphT;
          lastIslandB = st.bField;
          updateMergedClosedTubesInPlace(islandBuf, 0.032, (islIdx, phi, out) => {
            const p = evaluateMagneticIslandPoint(islIdx, phi, phi * 5 + islIdx, params);
            out.x = p.x;
            out.y = p.y;
            out.z = p.z;
          });
        }
      } else {
        islandMesh.visible = false;
      }

      // Axis core shifts to violent crimson when disrupted
      axisMat.color.copy(isDisrupted ? colorCrimson : colorPink);
      axisMat.emissive.copy(isDisrupted ? colorCrimson : colorPink);

      // Update shader uniforms
      plasmaMat.uniforms.uTime.value = elapsed;
      plasmaMat.uniforms.uBFieldNorm.value = st.bField / 20;
      plasmaMat.uniforms.uMorphT.value = st.morphT;
      plasmaMat.uniforms.uDisruption.value = st.disruptionFactor;

      // Sync interactive 3D orbit from Act 3's inertia controller
      rig.rotation.x = st.rotX;
      rig.rotation.y = st.rotY;

      renderer.render(scene, camera);
    });
    loop.start();

    return () => {
      loop.stop();
      io.disconnect();
      ro.disconnect();
      disposeThreeBundle(scene, renderer, envRT);
    };
  }, [stateRef, isActive]);

  return (
    <div
      ref={mountRef}
      data-testid="act3-manifold-canvas"
      data-interactive="true"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={className}
    />
  );
};
