import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createAdaptiveLoop,
  createSculpturalRenderer,
  disposeThreeBundle,
  GLSL_SIMPLEX_3D,
  useViewportWebGLActive,
} from './webglUtils';

export interface Act2VisualState {
  progress: number;
  stageIndex: number;
  pelletYPct: number;
  transitionEnergy: number;
  shockNonce: number;
}

export interface Act2Lithium3DProps {
  stateRef: React.MutableRefObject<Act2VisualState>;
  className?: string;
}

// High-contrast sculptural palettes calibrated to pop cleanly against BOTH the flat Act 2
// backdrop AND the giant foreground stage headline ink:
// Stage 0 (#FF1F71 Pink bg, #111114 black ink): Luminous Electric Cyan + Ceramic White + Solar Gold
// Stage 1 (#FF2A2A Crimson bg, #F6F3EB white ink): Deep Obsidian + Solar Gold + Violet rim
// Stage 2 (#00E676 Emerald bg, #111114 black ink): Luminous Acid Tungsten + Electric Cyan + White chrome
// Stage 3 (#00D8FF Cyan bg, #111114 black ink): Luminous Balmer Pink + Solar Gold + White chrome
const STAGE_PALETTES = [
  {
    primary: new THREE.Color('#00D8FF'),
    accent: new THREE.Color('#FFB800'),
    rim: new THREE.Color('#F6F3EB'),
  },
  {
    primary: new THREE.Color('#19151B'),
    accent: new THREE.Color('#FFB800'),
    rim: new THREE.Color('#6A2BFF'),
  },
  {
    primary: new THREE.Color('#EAFF2B'),
    accent: new THREE.Color('#00D8FF'),
    rim: new THREE.Color('#F6F3EB'),
  },
  {
    primary: new THREE.Color('#FF1F71'),
    accent: new THREE.Color('#FFB800'),
    rim: new THREE.Color('#F6F3EB'),
  },
];

const VORTEX_VERT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uProgress;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vNoise;

${GLSL_SIMPLEX_3D}

void main() {
  vUv = uv;
  float n = snoise(position * 1.15 + vec3(uTime * 0.55, -uTime * 0.4, uProgress * 3.5));
  vNoise = n * 0.5 + 0.5;
  float amp = 0.08 + uEnergy * 0.14;
  vec3 displaced = position + normal * (n * amp);
  vec4 wp = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const VORTEX_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uPrimary;
uniform vec3 uAccent;
uniform vec3 uRim;
uniform float uEnergy;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vNoise;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 2.75);
  float sharpRim = pow(1.0 - ndotv, 4.8);

  // Crisp Swiss helical spectral ribbons
  float stripe = 0.5 + 0.5 * sin(vUv.x * 50.2655 - vUv.y * 12.566 + uTime * 2.4 + vNoise * 2.6);
  float band = smoothstep(0.44, 0.86, stripe);

  vec3 L = normalize(vec3(3.0, 4.5, 5.0));
  vec3 H = normalize(L + V);
  float diff = 0.42 + 0.58 * max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, H), 0.0), 56.0);

  vec3 col = mix(uPrimary, uAccent, band * 0.80) * diff;
  col = mix(col, uRim, fresnel * 0.92);
  col += uRim * sharpRim * 0.55;
  col += uRim * spec * (0.95 + uEnergy * 0.55);

  float alpha = clamp(0.80 + fresnel * 0.20, 0.0, 0.96);
  gl_FragColor = vec4(col, alpha);
}
`;

const CRYSTAL_VERT = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const CRYSTAL_FRAG = /* glsl */ `
uniform vec3 uAccent;
uniform vec3 uRim;
uniform float uTime;

varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 2.0);

  vec3 L1 = normalize(vec3(3.0, 5.0, 4.0));
  vec3 L2 = normalize(vec3(-4.0, -2.0, 3.0));
  float d1 = max(dot(N, L1), 0.0);
  float d2 = max(dot(N, L2), 0.0);
  float spec = pow(max(dot(N, normalize(L1 + V)), 0.0), 42.0);

  // Iridescent faceted lithium metallic crystal
  vec3 irid = 0.5 + 0.5 * cos(6.28318 * (fresnel * 0.85 + uTime * 0.18 + vec3(0.0, 0.33, 0.67)));
  vec3 base = mix(vec3(0.92, 0.94, 0.98), uAccent, 0.35 + 0.45 * d2);
  vec3 col = base * (0.4 + 0.7 * d1) + irid * fresnel * 0.72 + uRim * spec * 1.1;
  gl_FragColor = vec4(col, 0.98);
}
`;

/**
 * ACT 02 — 3D LITHIUM PELLET IMPACT & PLASMA VORTEX
 * Driven directly by Act 2's scroll progress & shockwave impulses via mutable ref.
 * Contains: sculptural twisted plasma vortex knot + faceted iridescent 3D lithium crystal +
 * 10 orbiting ionized crystal shards + 3 glossy expanding 3D torus shockwave rings.
 * Zero THREE.Points, zero React setState in rAF.
 */
export const Act2Lithium3D: React.FC<Act2Lithium3DProps> = ({
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
      38,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      50
    );
    camera.position.set(0, 0, 8.2);
    camera.lookAt(0, 0, 0);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4, 5, 6);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0xffffff, 16, 18, 1.5);
    fillLight.position.set(-4, -3, 4);
    scene.add(fillLight);

    // 1. Sculptural Twisted Plasma Vortex Knot (slimmed ~15% for razor-sleek silhouette)
    const vortexGeom = new THREE.TorusKnotGeometry(1.64, 0.285, 116, 20, 2, 3);
    const curPrimary = STAGE_PALETTES[0].primary.clone();
    const curAccent = STAGE_PALETTES[0].accent.clone();
    const curRim = STAGE_PALETTES[0].rim.clone();

    const vortexMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uProgress: { value: 0 },
        uPrimary: { value: curPrimary },
        uAccent: { value: curAccent },
        uRim: { value: curRim },
      },
      vertexShader: VORTEX_VERT,
      fragmentShader: VORTEX_FRAG,
      transparent: true,
      depthWrite: true,
    });
    const vortexMesh = new THREE.Mesh(vortexGeom, vortexMat);
    vortexMesh.position.z = -0.6;
    scene.add(vortexMesh);

    // 2. Faceted 3D Metallic Lithium Crystal (flat-shaded octahedron stretched into lab crystal)
    const crystalGeom = new THREE.OctahedronGeometry(0.42, 0);
    crystalGeom.scale(0.82, 1.38, 0.82);
    crystalGeom.computeVertexNormals();

    const crystalMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAccent: { value: curAccent },
        uRim: { value: curRim },
      },
      vertexShader: CRYSTAL_VERT,
      fragmentShader: CRYSTAL_FRAG,
    });
    const crystalMesh = new THREE.Mesh(crystalGeom, crystalMat);
    crystalMesh.position.set(0, 1.5, 0.65);
    scene.add(crystalMesh);

    // 3. 10 Orbiting Solid Faceted Crystal Shards (bloom outward once ionized)
    const shardGeom = new THREE.OctahedronGeometry(0.115, 0);
    shardGeom.scale(0.75, 1.45, 0.75);
    shardGeom.computeVertexNormals();
    const shardMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#F6F3EB'),
      metalness: 0.92,
      roughness: 0.14,
      envMapIntensity: 1.8,
    });
    const shardGroup = new THREE.Group();
    scene.add(shardGroup);

    const shards: Array<{
      mesh: THREE.Mesh;
      angleOffset: number;
      tilt: number;
      radiusScale: number;
      speed: number;
    }> = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(shardGeom, shardMat);
      shardGroup.add(m);
      shards.push({
        mesh: m,
        angleOffset: (i / 10) * Math.PI * 2,
        tilt: ((i % 3) - 1) * 0.45,
        radiusScale: 0.88 + (i % 4) * 0.16,
        speed: 1.3 + (i % 3) * 0.45,
      });
    }

    // 4. 3 Glossy 3D Expanding Torus Shockwave Rings fired on threshold crossings
    const shockRings: Array<{
      mesh: THREE.Mesh;
      mat: THREE.MeshStandardMaterial;
      life: number; // 0 = idle, 0..1 = expanding
    }> = [];
    const ringGeom = new THREE.TorusGeometry(1.0, 0.042, 14, 72);
    for (let r = 0; r < 3; r++) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#FFFFFF'),
        emissive: new THREE.Color('#FFFFFF'),
        emissiveIntensity: 0.55,
        metalness: 0.9,
        roughness: 0.12,
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(ringGeom, mat);
      mesh.visible = false;
      scene.add(mesh);
      shockRings.push({ mesh, mat, life: 0 });
    }
    let nextRingIdx = 0;
    let lastShockNonce = stateRef.current.shockNonce;

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
      const palette = STAGE_PALETTES[st.stageIndex] ?? STAGE_PALETTES[0];
      const lerpC = 1 - Math.exp(-dt * 8.0);
      curPrimary.lerp(palette.primary, lerpC);
      curAccent.lerp(palette.accent, lerpC);
      curRim.lerp(palette.rim, lerpC);

      // Fire a 3D expanding torus shockwave ring whenever stage threshold crosses
      if (st.shockNonce !== lastShockNonce) {
        lastShockNonce = st.shockNonce;
        const ring = shockRings[nextRingIdx];
        nextRingIdx = (nextRingIdx + 1) % shockRings.length;
        ring.life = 0.001;
        ring.mesh.visible = true;
        ring.mesh.position.set(0, crystalMesh.position.y, 0.3);
        ring.mesh.rotation.set(
          Math.sin(elapsed * 2.1) * 0.35,
          Math.cos(elapsed * 1.7) * 0.35,
          0
        );
        ring.mat.emissive.copy(palette.accent);
      }

      // Vortex kinetic motion coupled to progress + transitionEnergy
      vortexMat.uniforms.uTime.value = elapsed;
      vortexMat.uniforms.uEnergy.value = st.transitionEnergy;
      vortexMat.uniforms.uProgress.value = st.progress;

      const vortexSpin = 0.25 + st.progress * 0.9 + st.transitionEnergy * 1.4;
      vortexMesh.rotation.y += dt * vortexSpin;
      vortexMesh.rotation.x = 0.35 + st.progress * 1.15 + Math.sin(elapsed * 0.5) * 0.14;
      vortexMesh.rotation.z = Math.cos(elapsed * 0.35) * 0.22;
      const vScale = 0.92 + st.transitionEnergy * 0.18;
      vortexMesh.scale.setScalar(vScale);

      // Faceted Lithium crystal drop & spin acceleration
      const worldY = THREE.MathUtils.lerp(1.9, -1.65, (st.pelletYPct - 12) / 60);
      crystalMesh.position.y = THREE.MathUtils.clamp(worldY, -1.75, 1.95);
      const crystalSpin = 1.1 + st.progress * 5.2 + st.transitionEnergy * 6.0;
      crystalMesh.rotation.y += dt * crystalSpin;
      crystalMesh.rotation.x += dt * crystalSpin * 0.55;
      crystalMat.uniforms.uTime.value = elapsed;

      // Ionized orbiting crystal shards expand cleanly out once progress > 0.20
      const ionFactor = THREE.MathUtils.smoothstep(st.progress, 0.18, 0.65);
      shardGroup.position.set(0, crystalMesh.position.y * 0.45, 0.2);
      shardMat.color.copy(curRim);
      for (let i = 0; i < shards.length; i++) {
        const sh = shards[i];
        const a = sh.angleOffset + elapsed * sh.speed * (0.6 + ionFactor * 1.2);
        const r = (0.35 + ionFactor * 2.25) * sh.radiusScale;
        sh.mesh.position.set(
          Math.cos(a) * r,
          Math.sin(a * 1.5 + sh.tilt) * r * 0.42,
          Math.sin(a) * r * 0.65
        );
        sh.mesh.rotation.set(a * 1.4, a * 2.1, sh.tilt);
        const s = 0.05 + ionFactor * 0.95;
        sh.mesh.scale.setScalar(s);
        sh.mesh.visible = ionFactor > 0.02;
      }

      // Advance expanding 3D torus shockwave rings
      for (let r = 0; r < shockRings.length; r++) {
        const ring = shockRings[r];
        if (ring.life > 0) {
          ring.life += dt * 1.15;
          if (ring.life >= 1) {
            ring.life = 0;
            ring.mesh.visible = false;
            ring.mat.opacity = 0;
          } else {
            const easeOut = 1 - Math.pow(1 - ring.life, 3);
            const s = 0.45 + easeOut * 4.4;
            ring.mesh.scale.setScalar(s);
            ring.mat.opacity = (1 - ring.life) * 0.88;
          }
        }
      }

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
      data-testid="act2-lithium-3d"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    />
  );
};
