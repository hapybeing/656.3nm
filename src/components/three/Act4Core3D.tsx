import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createAdaptiveLoop,
  createSculpturalRenderer,
  disposeThreeBundle,
  GLSL_SIMPLEX_3D,
  useViewportWebGLActive,
} from './webglUtils';

export interface Act4VisualState {
  nNorm: number;
  tNorm: number;
  tauNorm: number;
  qGain: number;
  isIgnited: boolean;
}

export interface Act4Core3DProps {
  stateRef: React.MutableRefObject<Act4VisualState>;
  className?: string;
}

const STAR_CORE_VERT = /* glsl */ `
uniform float uTime;
uniform float uN;
uniform float uT;
uniform float uQ;
uniform float uIgnited;

varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vBoil;

${GLSL_SIMPLEX_3D}

void main() {
  float preStress = smoothstep(0.60, 0.99, uQ) * (1.0 - uIgnited);
  float freq = 1.65 + uN * 2.4 + preStress * 1.9;
  float speed = 0.85 + uT * 1.4 + preStress * 2.8;

  float n1 = snoise(position * freq + vec3(uTime * speed, -uTime * speed * 0.7, uTime * 0.5));
  float n2 = snoise(position * (freq * 2.05) - vec3(uTime * speed * 1.2, uTime * 0.8, -uTime * 0.9));
  float boil = n1 * 0.65 + n2 * 0.35;
  vBoil = boil * 0.5 + 0.5;

  // Pre-ignition: violent turbulent vertex spikes; Post-ignition: calm harmonic solar pulse
  float harmonic = sin(position.y * 5.0 - uTime * 2.4) * 0.045;
  float disp = mix(
    boil * (0.09 + uN * 0.07 + preStress * 0.24),
    harmonic + boil * 0.065,
    uIgnited
  );

  vec3 displaced = position + normal * disp;
  vec4 wp = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const STAR_CORE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uN;
uniform float uT;
uniform float uQ;
uniform float uIgnited;

varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vBoil;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 2.2);
  float corona = pow(1.0 - ndotv, 4.0);

  vec3 balmerPink = vec3(1.0, 0.122, 0.443);  // #FF1F71
  vec3 crimson    = vec3(1.0, 0.165, 0.165);  // #FF2A2A
  vec3 emerald    = vec3(0.0, 0.902, 0.463);  // #00E676
  vec3 solarGold  = vec3(1.0, 0.722, 0.0);    // #FFB800
  vec3 deepViolet = vec3(0.416, 0.169, 1.0);  // #6A2BFF
  vec3 elecCyan   = vec3(0.0, 0.847, 1.0);    // #00D8FF
  vec3 whiteCyan  = vec3(0.95, 0.99, 1.0);

  // Temperature-driven spectral ramp: Pink -> Crimson -> Emerald -> Solar Gold -> White-Cyan
  vec3 ramp = mix(balmerPink, crimson, smoothstep(0.0, 0.28, uT));
  ramp = mix(ramp, emerald, smoothstep(0.28, 0.55, uT));
  ramp = mix(ramp, solarGold, smoothstep(0.55, 0.82, uT));
  ramp = mix(ramp, whiteCyan, smoothstep(0.82, 1.0, uT) * 0.75);

  float detail = smoothstep(0.22, 0.85, vBoil + uN * 0.18);
  vec3 darkCore = mix(vec3(0.09, 0.06, 0.14), ramp * 0.35, 0.45);
  vec3 col = mix(darkCore, ramp, detail);

  // Pre-ignition chromatic RGB Fresnel rim split (0.65..0.99 Q)
  float preStress = smoothstep(0.65, 0.99, uQ) * (1.0 - uIgnited);
  if (preStress > 0.01) {
    float splitWave = sin(vWorldPos.y * 8.0 + uTime * 12.0);
    vec3 chromaRim = mix(balmerPink, elecCyan, splitWave * 0.5 + 0.5);
    col += chromaRim * fresnel * preStress * 1.45;
  }

  // Post-ignition serene luminous burning star: golden-violet-cyan harmonic corona bands
  if (uIgnited > 0.01) {
    float band = 0.5 + 0.5 * sin(vWorldPos.y * 6.5 + vBoil * 3.0 - uTime * 1.8);
    vec3 ignitedCol = mix(solarGold, whiteCyan, smoothstep(0.35, 0.92, vBoil));
    ignitedCol = mix(ignitedCol, deepViolet, (1.0 - band) * 0.32);
    ignitedCol += mix(solarGold, elecCyan, band) * fresnel * 1.25;
    ignitedCol += whiteCyan * corona * 1.4;
    col = mix(col, ignitedCol, uIgnited);
  } else {
    col += mix(ramp, whiteCyan, 0.45) * fresnel * 0.95;
  }

  vec3 L = normalize(vec3(3.0, 4.0, 5.0));
  float spec = pow(max(dot(N, normalize(L + V)), 0.0), 36.0);
  col += whiteCyan * spec * 0.55;

  gl_FragColor = vec4(col, 0.98);
}
`;

/**
 * ACT 04 — LIVE 3D FUSION CORE REACTOR
 * High-subdivision 3D plasma star core (GLSL 3D simplex-noise boil + Fresnel corona)
 * surrounded by 3 glossy metallic 3D gyroscopic gimbal containment rings.
 * Wired live via ref to Lawson dials (n, T, τE) and ignition gain Q.
 */
export const Act4Core3D: React.FC<Act4Core3DProps> = ({
  stateRef,
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
      36,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      50
    );
    camera.position.set(0, 0, 5.25);
    camera.lookAt(0, 0, 0);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);

    const warmLight = new THREE.PointLight(0xffb800, 18, 15, 1.5);
    warmLight.position.set(-3.5, 2.4, 3.2);
    scene.add(warmLight);

    const cyanLight = new THREE.PointLight(0x00d8ff, 18, 15, 1.5);
    cyanLight.position.set(3.5, -2.0, 3.5);
    scene.add(cyanLight);

    const rig = new THREE.Group();
    scene.add(rig);

    // 1. High-Subdivision 3D Plasma Star Core
    const starGeom = new THREE.IcosahedronGeometry(1.06, 14);
    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uN: { value: 0.4 },
        uT: { value: 0.5 },
        uQ: { value: 0.5 },
        uIgnited: { value: 0 },
      },
      vertexShader: STAR_CORE_VERT,
      fragmentShader: STAR_CORE_FRAG,
    });
    const starMesh = new THREE.Mesh(starGeom, starMat);
    rig.add(starMesh);

    // 2. Three Concentric Glossy Metallic 3D Gyroscopic Gimbal Containment Rings
    const ringMatA = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#20222C'),
      metalness: 0.95,
      roughness: 0.14,
      envMapIntensity: 2.0,
    });
    const ringMatB = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#FF1F71'),
      emissive: new THREE.Color('#FF1F71'),
      emissiveIntensity: 0.25,
      metalness: 0.88,
      roughness: 0.18,
      envMapIntensity: 1.9,
    });
    const ringMatC = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#00D8FF'),
      emissive: new THREE.Color('#00D8FF'),
      emissiveIntensity: 0.25,
      metalness: 0.88,
      roughness: 0.18,
      envMapIntensity: 1.9,
    });

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.048, 8, 84), ringMatA);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.74, 0.036, 8, 84), ringMatB);
    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(1.94, 0.032, 8, 84), ringMatC);
    rig.add(ring1, ring2, ring3);

    const colDarkChrome = new THREE.Color('#20222C');
    const colGold = new THREE.Color('#FFB800');
    const colPink = new THREE.Color('#FF1F71');
    const colCyan = new THREE.Color('#00D8FF');
    const colViolet = new THREE.Color('#6A2BFF');

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
    let smoothIgnited = stateRef.current.isIgnited ? 1 : 0;

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
      const targetIgn = st.isIgnited ? 1 : 0;
      smoothIgnited += (targetIgn - smoothIgnited) * (1 - Math.exp(-dt * 5.5));

      starMat.uniforms.uTime.value = elapsed;
      starMat.uniforms.uN.value = st.nNorm;
      starMat.uniforms.uT.value = st.tNorm;
      starMat.uniforms.uQ.value = st.qGain;
      starMat.uniforms.uIgnited.value = smoothIgnited;

      starMesh.rotation.y = elapsed * (0.28 + st.tNorm * 0.35);
      starMesh.rotation.x = Math.sin(elapsed * 0.45) * 0.2;

      // Confinement time τE tightens rings inward and locks harmonic alignment
      const tighten = 1.12 - st.tauNorm * 0.22;
      ring1.scale.setScalar(tighten);
      ring2.scale.setScalar(tighten * 0.98);
      ring3.scale.setScalar(tighten * 0.96);

      const spinRate = 0.45 + st.tauNorm * 1.15 + smoothIgnited * 0.65;
      ring1.rotation.set(
        elapsed * spinRate * 0.65,
        elapsed * spinRate * 0.4,
        0.35 * (1 - smoothIgnited * 0.5)
      );
      ring2.rotation.set(
        -elapsed * spinRate * 0.5 + 0.9,
        elapsed * spinRate * 0.85,
        -0.45
      );
      ring3.rotation.set(
        elapsed * spinRate * 0.35 + 1.6,
        -elapsed * spinRate * 0.6,
        elapsed * spinRate * 0.25
      );

      // Shift gimbal metallic accent colors dramatically on ignition
      ringMatA.color.copy(colDarkChrome).lerp(colGold, smoothIgnited);
      ringMatA.emissive.copy(colGold);
      ringMatA.emissiveIntensity = smoothIgnited * 0.45;

      ringMatB.color.copy(colPink).lerp(colCyan, smoothIgnited);
      ringMatB.emissive.copy(ringMatB.color);
      ringMatB.emissiveIntensity = 0.22 + smoothIgnited * 0.4;

      ringMatC.color.copy(colCyan).lerp(colViolet, smoothIgnited);
      ringMatC.emissive.copy(ringMatC.color);
      ringMatC.emissiveIntensity = 0.22 + smoothIgnited * 0.45;

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
      data-testid="act4-core-3d"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    />
  );
};
