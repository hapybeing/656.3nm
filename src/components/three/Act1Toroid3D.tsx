import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { motionEngine } from '../../engine/motionEngine';
import {
  createAdaptiveLoop,
  createMergedClosedTubesBuffer,
  createSculpturalRenderer,
  disposeThreeBundle,
  GLSL_SIMPLEX_3D,
  updateMergedClosedTubesInPlace,
  useViewportWebGLActive,
} from './webglUtils';

/**
 * Builds the Miller D-shaped parametric tokamak plasma torus (96x40).
 */
function buildMillerPlasmaGeometry(
  phiSteps = 96,
  thetaSteps = 40
): THREE.BufferGeometry {
  const R0 = 1.62;
  const a = 0.62;
  const delta = 0.42;
  const kappa = 1.52;

  const vertCount = (phiSteps + 1) * (thetaSteps + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = new Uint32Array(phiSteps * thetaSteps * 6);

  let pPtr = 0;
  let uPtr = 0;
  for (let i = 0; i <= phiSteps; i++) {
    const u = i / phiSteps;
    const phi = u * Math.PI * 2;
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);
    for (let j = 0; j <= thetaSteps; j++) {
      const v = j / thetaSteps;
      const theta = v * Math.PI * 2;
      const R = R0 + a * Math.cos(theta + delta * Math.sin(theta));
      const Z = kappa * a * Math.sin(theta);

      positions[pPtr++] = R * cp;
      positions[pPtr++] = Z;
      positions[pPtr++] = R * sp;

      uvs[uPtr++] = u;
      uvs[uPtr++] = v;
    }
  }

  let idxPtr = 0;
  for (let i = 0; i < phiSteps; i++) {
    for (let j = 0; j < thetaSteps; j++) {
      const a0 = i * (thetaSteps + 1) + j;
      const b0 = (i + 1) * (thetaSteps + 1) + j;
      const c0 = (i + 1) * (thetaSteps + 1) + (j + 1);
      const d0 = i * (thetaSteps + 1) + (j + 1);
      indices[idxPtr++] = a0;
      indices[idxPtr++] = b0;
      indices[idxPtr++] = d0;
      indices[idxPtr++] = b0;
      indices[idxPtr++] = c0;
      indices[idxPtr++] = d0;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals();
  return geom;
}

const PLASMA_VERT = /* glsl */ `
uniform float uTime;
uniform float uPointerEnergy;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vWave;

${GLSL_SIMPLEX_3D}

void main() {
  vUv = uv;
  float helicalPhase = uv.x * 18.849556 - uv.y * 12.56637 + uTime * 1.4;
  float n = snoise(position * 1.35 + vec3(uTime * 0.45, -uTime * 0.3, uTime * 0.35));
  float ripple = (sin(helicalPhase) * 0.028 + n * 0.048) * (1.0 + uPointerEnergy * 0.65);
  vWave = n * 0.5 + 0.5;

  vec3 displaced = position + normal * ripple;
  vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const PLASMA_FRAG = /* glsl */ `
uniform float uTime;
uniform float uPointerEnergy;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vWave;

${GLSL_SIMPLEX_3D}

void main() {
  vec3 N = normalize(vWorldNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);

  // "Invisible Core" Fresnel physics: center facing viewer stays transparent vacuum;
  // grazing Balmer-alpha boundary shells erupt in vivid spectral colour.
  float fresnel = pow(1.0 - ndotv, 1.95);
  float outerRim = pow(1.0 - ndotv, 3.4);

  // Domain-warped helical MHD flow ribbons
  float warp = snoise(vWorldPos * 1.55 + vec3(uTime * 0.55, uTime * 0.35, -uTime * 0.4));
  float helix1 = 0.5 + 0.5 * sin(vUv.x * 37.6991 - vUv.y * 12.56637 + uTime * 2.1 + warp * 3.0);
  float helix2 = 0.5 + 0.5 * cos(vUv.x * 25.1327 + vUv.y * 18.84955 - uTime * 1.6 + warp * 2.4);
  float ribbon = smoothstep(0.42, 0.94, helix1) * 0.72 + smoothstep(0.55, 0.97, helix2) * 0.5;

  vec3 balmerPink = vec3(1.0, 0.122, 0.443);   // #FF1F71
  vec3 elecCyan   = vec3(0.0, 0.847, 1.0);     // #00D8FF
  vec3 deepUV     = vec3(0.416, 0.169, 1.0);   // #6A2BFF
  vec3 hotWhite   = vec3(0.98, 0.97, 1.0);

  vec3 baseSpectrum = mix(deepUV, balmerPink, smoothstep(0.18, 0.82, vWave + helix1 * 0.35));
  baseSpectrum = mix(baseSpectrum, elecCyan, smoothstep(0.52, 0.95, helix2) * 0.78);

  // Crisp studio specular sheen
  vec3 L1 = normalize(vec3(3.5, 4.5, 5.0));
  vec3 L2 = normalize(vec3(-4.0, -2.5, 3.0));
  vec3 H1 = normalize(L1 + V);
  vec3 H2 = normalize(L2 + V);
  float spec = pow(max(dot(N, H1), 0.0), 28.0) * 0.7 + pow(max(dot(N, H2), 0.0), 20.0) * 0.45;

  vec3 color = baseSpectrum * (0.85 + 0.65 * fresnel + 0.45 * ribbon);
  color += mix(balmerPink, elecCyan, helix2) * outerRim * 0.9;
  color += hotWhite * spec * (0.45 + outerRim * 0.85);

  // Transparent optical vacuum core + crisp solid-feeling Fresnel emission rim
  float coreFloor = 0.08 + ribbon * 0.22;
  float alpha = clamp(coreFloor + fresnel * 0.88 + outerRim * 0.35 + spec * 0.3, 0.0, 0.98);

  gl_FragColor = vec4(color, alpha);
}
`;

export interface Act1Toroid3DProps {
  className?: string;
}

/**
 * ACT 01 — 3D OPTICAL PLASMA TOROID
 * Solid Miller D-shaped parametric plasma torus with custom GLSL "Invisible Core"
 * Fresnel spectroscopy shader wrapped inside 12 glossy metallic-obsidian D-shaped coils.
 * Zero THREE.Points, zero particle slop, auto-paused offscreen via IntersectionObserver.
 */
export const Act1Toroid3D: React.FC<Act1Toroid3DProps> = ({ className = '' }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const isActive = useViewportWebGLActive(mountRef, true, '160px 0px 160px 0px');

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !isActive) return;

    const bundle = createSculpturalRenderer(container);
    if (!bundle) return;
    const { renderer, envRT, isSoftwareGl } = bundle;

    const scene = new THREE.Scene();
    scene.environment = envRT.texture;

    const camera = new THREE.PerspectiveCamera(
      36,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      50
    );
    camera.position.set(0, 0.35, 7.6);
    camera.lookAt(0, 0, 0);

    // Sculptural studio lighting catching the 12 metallic D-coils
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(4.5, 6.0, 5.5);
    scene.add(keyLight);

    const pinkRim = new THREE.PointLight(0xff1f71, 22, 16, 1.6);
    pinkRim.position.set(-3.8, 2.2, 3.6);
    scene.add(pinkRim);

    const cyanRim = new THREE.PointLight(0x00d8ff, 22, 16, 1.6);
    cyanRim.position.set(3.8, -2.0, 3.8);
    scene.add(cyanRim);

    const uvBack = new THREE.PointLight(0x6a2bff, 14, 15, 1.6);
    uvBack.position.set(0, 2.8, -4.2);
    scene.add(uvBack);

    const rig = new THREE.Group();
    scene.add(rig);

    // 1. 12 Glossy Metallic-Obsidian / Chrome 3D D-Shaped Magnetic Field Coils (1 draw call)
    const coilBuf = createMergedClosedTubesBuffer(12, 32, 8);
    const coilR0 = 1.62;
    const coilA = 0.84;
    const coilDelta = 0.42;
    const coilKappa = 1.52;
    updateMergedClosedTubesInPlace(coilBuf, 0.052, (coilIdx, theta, out) => {
      const phi = (coilIdx / 12) * Math.PI * 2;
      const R = coilR0 + coilA * Math.cos(theta + coilDelta * Math.sin(theta));
      const Z = coilKappa * coilA * Math.sin(theta);
      out.x = R * Math.cos(phi);
      out.y = Z;
      out.z = R * Math.sin(phi);
    });
    const coilMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#232532'),
      metalness: 0.94,
      roughness: 0.14,
      envMapIntensity: 1.8,
    });
    const coilsMesh = new THREE.Mesh(coilBuf.geometry, coilMat);
    rig.add(coilsMesh);

    // 2. Crisp Upper & Lower Poloidal Chrome Ring Crowns
    const crownMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#E8EBF5'),
      metalness: 0.96,
      roughness: 0.1,
      envMapIntensity: 2.0,
    });
    const crownTop = new THREE.Mesh(
      new THREE.TorusGeometry(1.62, 0.026, 10, 72),
      crownMat
    );
    crownTop.rotation.x = Math.PI * 0.5;
    crownTop.position.y = 1.32;
    rig.add(crownTop);

    const crownBot = new THREE.Mesh(
      new THREE.TorusGeometry(1.62, 0.026, 10, 72),
      crownMat
    );
    crownBot.rotation.x = Math.PI * 0.5;
    crownBot.position.y = -1.32;
    rig.add(crownBot);

    // 3. Miller D-Shaped Plasma Torus with "Invisible Core" GLSL Fresnel Shader
    const plasmaGeom = buildMillerPlasmaGeometry(96, 40);
    const plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPointerEnergy: { value: 0 },
      },
      vertexShader: PLASMA_VERT,
      fragmentShader: PLASMA_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const plasmaMesh = new THREE.Mesh(plasmaGeom, plasmaMat);
    plasmaMesh.renderOrder = 2;
    rig.add(plasmaMesh);

    // Initial heroic sculptural pose
    rig.rotation.set(0.54, 0.35, -0.14);

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

    let tiltX = 0;
    let tiltY = 0;
    let pointerEnergy = 0;
    let lastTs = performance.now();
    let elapsed = 0;

    // Render initial crisp frame synchronously
    renderer.render(scene, camera);

    const loop = createAdaptiveLoop(renderer, isSoftwareGl, (now) => {
      if (!isVisible) {
        lastTs = now;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTs) * 0.001));
      lastTs = now;
      elapsed += dt;

      // Read normalized pointer cleanly from global motionEngine (zero React state)
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      const hasPointer = motionEngine.pointerX >= 0 && motionEngine.pointerY >= 0;
      const targetNormX = hasPointer ? (motionEngine.pointerX / vw) * 2 - 1 : 0;
      const targetNormY = hasPointer ? (motionEngine.pointerY / vh) * 2 - 1 : 0;

      const lerpAlpha = 1 - Math.exp(-dt * 4.5);
      tiltX += (targetNormY * 0.38 - tiltX) * lerpAlpha;
      tiltY += (targetNormX * 0.48 - tiltY) * lerpAlpha;
      const targetEnergy = hasPointer
        ? Math.min(1, Math.hypot(targetNormX, targetNormY) * 0.9)
        : 0.25;
      pointerEnergy += (targetEnergy - pointerEnergy) * lerpAlpha;

      plasmaMat.uniforms.uTime.value = elapsed;
      plasmaMat.uniforms.uPointerEnergy.value = pointerEnergy;

      rig.rotation.y = elapsed * 0.34 + tiltY;
      rig.rotation.x = 0.54 + Math.sin(elapsed * 0.42) * 0.14 + tiltX;
      rig.rotation.z = -0.14 + Math.cos(elapsed * 0.31) * 0.08;

      renderer.render(scene, camera);
    });
    loop.start();

    return () => {
      loop.stop();
      io.disconnect();
      ro.disconnect();
      disposeThreeBundle(scene, renderer, envRT);
    };
  }, [isActive]);

  return (
    <div
      ref={mountRef}
      data-testid="act1-toroid-3d"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    />
  );
};
