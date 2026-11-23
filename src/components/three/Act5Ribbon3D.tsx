import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createAdaptiveLoop,
  createSculpturalRenderer,
  disposeThreeBundle,
  useViewportWebGLActive,
} from './webglUtils';

export interface Act5Ribbon3DProps {
  /** 7-element float array of live coupled wordmark spring displacements (-1..+1) */
  charEnergyRef: React.MutableRefObject<Float32Array>;
  className?: string;
}

const RIBBON_VERT = /* glsl */ `
uniform float uTime;
uniform float uCharEnergy[7];

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vEnergy;

// Smoothly samples the 7 coupled wordmark character springs across ribbon u (0..1)
float sampleCharWave(float u) {
  float sum = 0.0;
  for (int i = 0; i < 7; i++) {
    float center = (float(i) + 0.5) / 7.0;
    float d = (u - center) * 6.2;
    sum += uCharEnergy[i] * exp(-d * d);
  }
  return sum;
}

void main() {
  vUv = uv;
  float u = uv.x;
  float v = uv.y - 0.5; // -0.5 .. +0.5 across ribbon width

  float x = (u - 0.5) * 10.6;
  float charWave = sampleCharWave(u);
  vEnergy = abs(charWave);

  // Sculptural Mobius-inspired helical twist + coupled 3D wave ridge
  float twist = u * 4.712389 + uTime * 0.52 + charWave * 1.45;
  float halfW = 1.15 + abs(charWave) * 0.25;

  float baseY = sin(u * 6.283185 + uTime * 0.7) * 0.34 + charWave * 0.72;
  float baseZ = cos(u * 4.2 - uTime * 0.55) * 0.42 + abs(charWave) * 0.55;

  vec3 pos = vec3(
    x,
    baseY + v * halfW * cos(twist),
    baseZ + v * halfW * sin(twist)
  );

  // Analytical surface normal from twist cross-section
  vec3 normalLocal = normalize(vec3(
    -sin(u * 6.283185 + uTime * 0.7) * 0.16,
    -sin(twist),
    cos(twist)
  ));

  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normalLocal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const RIBBON_FRAG = /* glsl */ `
uniform float uTime;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vEnergy;

void main() {
  vec3 N = normalize(vWorldNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 1.85);
  float edgeGlow = smoothstep(0.36, 0.5, abs(vUv.y - 0.5));

  // Full 6-wavelength spectral dispersion palette mapped smoothly across u + thin-film interference
  vec3 cPink   = vec3(1.0, 0.122, 0.443);  // #FF1F71
  vec3 cRed    = vec3(1.0, 0.165, 0.165);  // #FF2A2A
  vec3 cGreen  = vec3(0.0, 0.902, 0.463);  // #00E676
  vec3 cCyan   = vec3(0.0, 0.847, 1.0);    // #00D8FF
  vec3 cViolet = vec3(0.416, 0.169, 1.0);  // #6A2BFF
  vec3 cGold   = vec3(1.0, 0.722, 0.0);    // #FFB800

  float t = fract(vUv.x * 1.15 - uTime * 0.075 + fresnel * 0.35 + vEnergy * 0.25);
  vec3 specCol = mix(cPink, cRed, smoothstep(0.0, 0.18, t));
  specCol = mix(specCol, cGold, smoothstep(0.18, 0.36, t));
  specCol = mix(specCol, cGreen, smoothstep(0.36, 0.54, t));
  specCol = mix(specCol, cCyan, smoothstep(0.54, 0.74, t));
  specCol = mix(specCol, cViolet, smoothstep(0.74, 0.90, t));
  specCol = mix(specCol, cPink, smoothstep(0.90, 1.0, t));

  // Iridescent thin-film prism interference striations
  float filmPhase = ndotv * 5.2 + vUv.x * 8.0 - uTime * 0.9 + vEnergy * 4.5;
  vec3 thinFilm = 0.5 + 0.5 * cos(filmPhase + vec3(0.0, 2.094, 4.188));

  vec3 obsidian = vec3(0.045, 0.048, 0.068);
  vec3 col = mix(obsidian, specCol, 0.34 + fresnel * 0.62 + vEnergy * 0.42);
  col += thinFilm * specCol * (0.28 + fresnel * 0.65 + vEnergy * 0.55);
  col += specCol * edgeGlow * 0.85;

  // Razor-crisp optical glass specular highlight
  vec3 L = normalize(vec3(2.5, 4.5, 6.0));
  float spec = pow(max(dot(N, normalize(L + V)), 0.0), 40.0);
  col += vec3(1.0, 0.98, 0.96) * spec * (0.7 + vEnergy * 0.5);

  float alpha = clamp(0.68 + fresnel * 0.3 + edgeGlow * 0.22, 0.0, 0.96);
  gl_FragColor = vec4(col, alpha);
}
`;

/**
 * ACT 05 — 3D IRIDESCENT SPECTRAL PRISM RIBBON
 * Full-width horizontal sculptural twisted glass-plasma ribbon sitting behind the
 * 656.3nm wordmark. Driven live by `uniform float uCharEnergy[7]` from the 7
 * coupled Newton's Cradle wordmark springs.
 */
export const Act5Ribbon3D: React.FC<Act5Ribbon3DProps> = ({
  charEnergyRef,
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
      34,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      50
    );
    camera.position.set(0, 0.15, 7.8);
    camera.lookAt(0, 0, 0);

    const ribbonGeom = new THREE.PlaneGeometry(1, 1, 96, 16);
    const energyUniformArray = [0, 0, 0, 0, 0, 0, 0];

    const ribbonMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCharEnergy: { value: energyUniformArray },
      },
      vertexShader: RIBBON_VERT,
      fragmentShader: RIBBON_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const ribbonMesh = new THREE.Mesh(ribbonGeom, ribbonMat);
    scene.add(ribbonMesh);

    let isVisible = true;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          isVisible = e.isIntersecting;
        }
      },
      { threshold: 0.01, rootMargin: '160px 0px 160px 0px' }
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

      const src = charEnergyRef.current;
      for (let i = 0; i < 7; i++) {
        energyUniformArray[i] = src[i] ?? 0;
      }
      ribbonMat.uniforms.uTime.value = elapsed;

      renderer.render(scene, camera);
    });
    loop.start();

    return () => {
      loop.stop();
      io.disconnect();
      ro.disconnect();
      disposeThreeBundle(scene, renderer, envRT);
    };
  }, [charEnergyRef, isActive]);

  return (
    <div
      ref={mountRef}
      data-testid="act5-ribbon-3d"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    />
  );
};
