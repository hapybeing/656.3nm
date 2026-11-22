import React, { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONTENT, type SpectralStage } from '../data/content';
import { motionEngine } from '../engine/motionEngine';
import { spectralAudio } from '../engine/spectralAudio';
import { stepSpring, type SpringState } from '../physics/motionMath';
import {
  ACT2_TIMING,
  ATOMIC_EMISSION_PEAKS,
  buildOscilloscopeCurvePath,
  computeAct2ScrollState,
  computeCenterOutCharPose,
  generateFraunhoferSpectrometer,
} from '../physics/spectroscopyMath';
import { KineticText } from './KineticText';

gsap.registerPlugin(ScrollTrigger);

export interface Act2LithiumProps {
  activeStageIndex: number;
  onSelectStage: (index: number) => void;
}

/**
 * ACT 02 — DROP THE LITHIUM (16,000 FPS Optical Shockwave Chamber)
 * Pinned scroll-scrubbed optical spectroscopy installation:
 * - 4 full-bleed stacked spectral surfaces (#FF1F71 -> #FF2A2A -> #00E676 -> #00D8FF)
 * - GPU-composited multi-ring radial clip-path shockwave wipes from live pellet impact
 * - Procedural 60fps HTML5 Canvas 2D optical interferometer standing-wave fringes
 * - Center-out 3D-hinge Roboto Flex eruption + 2 hollow streak-camera ghost trails
 * - Live 380nm–700nm Fraunhofer/Balmer spectrometer + oscilloscope intensity curve & caliper
 * Zero React useState inside rAF or ScrollTrigger.onUpdate.
 */
export const Act2Lithium: React.FC<Act2LithiumProps> = ({
  activeStageIndex,
  onSelectStage,
}) => {
  const rootRef = useRef<HTMLElement | null>(null);
  const interferometerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);

  // Stacked flat spectral color plates (layers 1..3 animate GPU clip-path circle wipes)
  const bgLayerRefs = useRef<Array<HTMLDivElement | null>>([]);
  // Synchronized clipped stage content layers sitting strictly ABOVE the interferometer canvas
  const contentLayerRefs = useRef<Array<HTMLDivElement | null>>([]);
  // Per-stage headline & streak-camera ghost refs
  const stageCharGroupsRef = useRef<Array<HTMLElement[]>>([[], [], [], []]);
  const ghost1Refs = useRef<Array<HTMLDivElement | null>>([]);
  const ghost2Refs = useRef<Array<HTMLDivElement | null>>([]);

  // Center drop spine, plasma wake, diamond pellet, and 2 concentric SVG shockfront rings
  const pelletGroupRef = useRef<HTMLDivElement | null>(null);
  const wakeRef = useRef<HTMLDivElement | null>(null);
  const shockSvgRef = useRef<SVGSVGElement | null>(null);
  const shockRingOuterRef = useRef<SVGCircleElement | null>(null);
  const shockRingInnerRef = useRef<SVGCircleElement | null>(null);
  const shockLabelRef = useRef<SVGTextElement | null>(null);

  // Direct-DOM live telemetry & spectrometer refs
  const timeReadoutRef = useRef<HTMLSpanElement | null>(null);
  const oscPathRef = useRef<SVGPathElement | null>(null);
  const caliperRef = useRef<HTMLDivElement | null>(null);
  const specActiveLabelRef = useRef<HTMLSpanElement | null>(null);

  // Mutable 60fps progress & discrete stage ref (zero useState churn)
  const scrubProxyRef = useRef({ progress: 0 });
  const lastDiscreteStageRef = useRef(activeStageIndex);
  const onSelectStageRef = useRef(onSelectStage);
  onSelectStageRef.current = onSelectStage;

  const fraunhoferTicks = useMemo(
    () =>
      generateFraunhoferSpectrometer(
        CONTENT.act2.spectrometerBounds.minNm,
        CONTENT.act2.spectrometerBounds.maxNm
      ),
    []
  );

  // Pre-cache per-stage .k-char lists once mounted
  useEffect(() => {
    const groups: Array<HTMLElement[]> = [[], [], [], []];
    for (let i = 0; i < 4; i++) {
      const layer = contentLayerRefs.current[i];
      if (!layer) continue;
      groups[i] = Array.from(
        layer.querySelectorAll<HTMLElement>('[data-solid-headline="true"] .k-char')
      );
    }
    stageCharGroupsRef.current = groups;
  }, []);

  // Pinned ScrollTrigger choreography (+=340%, scrub: 0.45, anticipatePin: 1)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      scrubProxyRef.current.progress = 0;

      const tween = gsap.to(scrubProxyRef.current, {
        progress: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: '+=340%',
          pin: true,
          scrub: 0.45,
          anticipatePin: 1,
        },
      });

      scrollTriggerRef.current = tween.scrollTrigger ?? null;
    }, rootRef);

    return () => {
      scrollTriggerRef.current = null;
      ctx.revert();
    };
  }, []);

  // Dedicated 60fps Act 2 render loop (auto-paused offscreen via IntersectionObserver)
  useEffect(() => {
    const root = rootRef.current;
    const canvas = interferometerCanvasRef.current;
    if (!root || !canvas) return;

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    let isVisible = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisible = entry.isIntersecting;
        }
      },
      { threshold: 0.01, rootMargin: '120px 0px 120px 0px' }
    );
    observer.observe(root);

    let canvasW = 1;
    let canvasH = 1;
    const resizeCanvas = () => {
      const rect = root.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextW = Math.max(1, Math.round(rect.width));
      const nextH = Math.max(1, Math.round(rect.height));
      if (nextW === canvasW && nextH === canvasH && canvas.width === Math.round(nextW * dpr)) {
        return;
      }
      canvasW = nextW;
      canvasH = nextH;
      canvas.width = Math.round(canvasW * dpr);
      canvas.height = Math.round(canvasH * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(root);
    window.addEventListener('resize', resizeCanvas, { passive: true });

    // Springs for magnetically gliding spectrometer caliper & smooth wavelength frequency shift
    const caliperNmSpring: SpringState = {
      pos: CONTENT.act2.stages[0].nm,
      vel: 0,
    };
    const freqNmSpring: SpringState = {
      pos: CONTENT.act2.stages[0].nm,
      vel: 0,
    };
    const ghostOffsetSpring: SpringState = { pos: 0, vel: 0 };

    let prevProgress = -1;
    let rafId = 0;
    let lastTs = performance.now();

    // Dirty-check caches to avoid redundant DOM & variable-font rasterizer invalidation at rest
    const lastAppliedReveals = [-1, -1, -1, -1];
    const lastClipKeys = ['', '', '', ''];
    let lastGhostKey = '';
    let lastTimeText = '';

    const minNm = CONTENT.act2.spectrometerBounds.minNm;
    const maxNm = CONTENT.act2.spectrometerBounds.maxNm;
    const nmSpan = maxNm - minNm;

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (!isVisible) {
        lastTs = now;
        return;
      }

      const dtMs = Math.min(48, Math.max(4, now - lastTs));
      lastTs = now;
      const dtFactor = dtMs / 16.6667;
      const timeSec = now * 0.001;

      const progress = scrubProxyRef.current.progress;
      const progressDelta = prevProgress < 0 ? 0 : progress - prevProgress;
      prevProgress = progress;

      const state = computeAct2ScrollState(progress);
      const activeStage: SpectralStage =
        CONTENT.act2.stages[state.activeStageIndex] ?? CONTENT.act2.stages[0];

      // Notify parent ONLY on discrete stage threshold crossing (max 3x across entire scroll)
      if (state.activeStageIndex !== lastDiscreteStageRef.current) {
        lastDiscreteStageRef.current = state.activeStageIndex;
        onSelectStageRef.current(state.activeStageIndex);
        spectralAudio.playIonizationChime(activeStage.nm);
      }

      // 1. Live reactor microsecond clock (00.000 ms -> 12.400 ms)
      const timeText = `${state.timeMs.toFixed(3).padStart(6, '0')} ms`;
      if (timeReadoutRef.current && timeText !== lastTimeText) {
        lastTimeText = timeText;
        timeReadoutRef.current.textContent = timeText;
      }

      // Exact CSS clip-path: circle(R%) reference length per CSS Shapes spec
      const cssCircleRefLen = Math.hypot(canvasW, canvasH) / Math.SQRT2;
      const impactX = canvasW * 0.5;
      const impactY = (canvasH * state.pelletYPct) / 100;

      // 2. Lithium pellet vertical drop + trailing segmented plasma wake
      if (pelletGroupRef.current) {
        pelletGroupRef.current.style.top = `${state.pelletYPct}%`;
      }
      if (wakeRef.current) {
        const wakeHeightPct = Math.max(2, state.pelletYPct - 12);
        wakeRef.current.style.top = '12%';
        wakeRef.current.style.height = `${wakeHeightPct}%`;
      }

      // 3. Synchronized GPU radial clip-path wipes for bg plates & incoming stage content
      for (let i = 1; i <= 3; i++) {
        const rPct = state.layerClipRadiiPct[i];
        const key = `${rPct.toFixed(2)}@${state.pelletYPct.toFixed(2)}@${canvasW}x${canvasH}`;
        if (key !== lastClipKeys[i]) {
          lastClipKeys[i] = key;
          const clip = `circle(${rPct}% at 50% ${state.pelletYPct}%)`;
          const bgLayer = bgLayerRefs.current[i];
          if (bgLayer) bgLayer.style.clipPath = clip;
          const contentLayer = contentLayerRefs.current[i];
          if (contentLayer) contentLayer.style.clipPath = clip;
        }
      }

      // Cross-fade outgoing stage content cleanly before incoming shockwave reaches the headline band
      for (let i = 0; i < 3; i++) {
        const contentLayer = contentLayerRefs.current[i];
        if (!contentLayer) continue;
        const nextWipe = state.layerClipRadiiPct[i + 1];
        if (nextWipe <= 8) {
          contentLayer.style.opacity = '1';
          contentLayer.style.visibility = 'visible';
        } else if (nextWipe >= 32) {
          contentLayer.style.opacity = '0';
          contentLayer.style.visibility = 'hidden';
        } else {
          const fade = 1 - (nextWipe - 8) / 24;
          contentLayer.style.opacity = fade.toFixed(3);
          contentLayer.style.visibility = 'visible';
        }
      }

      // 4. Two concentric high-contrast SVG shockfront rings riding pixel-perfectly on the wipe seam
      if (
        shockSvgRef.current &&
        shockRingOuterRef.current &&
        shockRingInnerRef.current &&
        shockLabelRef.current
      ) {
        if (state.shockfront.active) {
          const rOuter = (state.shockfront.radiusPct / 100) * cssCircleRefLen;
          const rInner = Math.max(0, rOuter * 0.87);

          shockSvgRef.current.style.opacity = String(
            Math.min(1, 0.35 + state.shockfront.strength * 0.85)
          );
          shockRingOuterRef.current.setAttribute('cx', impactX.toFixed(1));
          shockRingOuterRef.current.setAttribute('cy', impactY.toFixed(1));
          shockRingOuterRef.current.setAttribute('r', rOuter.toFixed(1));

          shockRingInnerRef.current.setAttribute('cx', impactX.toFixed(1));
          shockRingInnerRef.current.setAttribute('cy', impactY.toFixed(1));
          shockRingInnerRef.current.setAttribute('r', rInner.toFixed(1));

          // Anchor radius readout cleanly along upper-right 35deg tangent inside viewport bounds
          const labelX = Math.max(
            24,
            Math.min(canvasW - 116, impactX + rInner * 0.78 + 10)
          );
          const labelY = Math.max(
            110,
            Math.min(canvasH - 180, impactY - rInner * 0.35)
          );
          shockLabelRef.current.setAttribute('x', labelX.toFixed(1));
          shockLabelRef.current.setAttribute('y', labelY.toFixed(1));
          shockLabelRef.current.textContent = `R: ${state.shockfront.radiusMm.toFixed(1)}mm`;
        } else {
          shockSvgRef.current.style.opacity = '0';
        }
      }

      // 5. Center-out 3D-hinge variable typography + streak-camera hollow ghost trails (dirty-checked!)
      const rawScrollImpulse =
        progressDelta * 950 + motionEngine.smoothVelocity * 0.55;
      const shockBoost =
        state.transitionEnergy * 24 * (rawScrollImpulse >= 0 ? 1 : -1);
      const targetGhost = Math.max(
        -26,
        Math.min(26, rawScrollImpulse * 0.7 + shockBoost)
      );
      stepSpring(ghostOffsetSpring, targetGhost, 0.2, 0.7, dtFactor);

      const ghostY = ghostOffsetSpring.pos;
      const ghostAbs = Math.abs(ghostY);
      const ghostOpacity1 = Math.min(0.75, ghostAbs / 14);
      const ghostOpacity2 = Math.min(0.42, ghostAbs / 18);
      const ghostKey = ghostAbs > 0.35 ? `${ghostY.toFixed(1)}` : '0';
      const ghostChanged = ghostKey !== lastGhostKey;
      lastGhostKey = ghostKey;

      for (let stageIdx = 0; stageIdx < 4; stageIdx++) {
        const reveal = state.stageReveals[stageIdx];
        if (Math.abs(reveal - lastAppliedReveals[stageIdx]) > 0.0008) {
          lastAppliedReveals[stageIdx] = reveal;
          const chars = stageCharGroupsRef.current[stageIdx];
          const total = chars.length;

          if (total > 0) {
            for (let c = 0; c < total; c++) {
              const el = chars[c];
              const pose = computeCenterOutCharPose(c, total, reveal);
              const st = el.style;
              st.setProperty('--wdth', String(pose.wdth));
              st.setProperty('--wght', String(pose.wght));
              st.setProperty('--slnt', String(pose.slnt));
              st.transform = `rotateX(${pose.rotateXDeg}deg)`;
              st.opacity = String(pose.opacity);
            }
          }
        }

        const g1 = ghost1Refs.current[stageIdx];
        const g2 = ghost2Refs.current[stageIdx];
        if (g1 && g2 && ghostChanged) {
          if (ghostAbs > 0.35 && reveal > 0.08) {
            const x1 = (ghostY * 0.48).toFixed(1);
            const y1 = (ghostY * 0.72).toFixed(1);
            const x2 = (ghostY * 0.92).toFixed(1);
            const y2 = (ghostY * 1.18).toFixed(1);
            g1.style.opacity = ghostOpacity1.toFixed(3);
            g1.style.transform = `translate3d(${x1}px, ${y1}px, 0)`;
            g1.style.setProperty(
              '--wdth',
              String(Math.max(75, 124 - ghostAbs * 1.4).toFixed(0))
            );

            g2.style.opacity = ghostOpacity2.toFixed(3);
            g2.style.transform = `translate3d(${x2}px, ${y2}px, 0)`;
            g2.style.setProperty(
              '--wdth',
              String(Math.max(55, 124 - ghostAbs * 2.2).toFixed(0))
            );
          } else {
            g1.style.opacity = '0';
            g2.style.opacity = '0';
          }
        }
      }

      // 6. Live Fraunhofer / Balmer Oscilloscope Curve + Magnetic Optical Caliper
      stepSpring(caliperNmSpring, activeStage.nm, 0.14, 0.74, dtFactor);
      stepSpring(freqNmSpring, activeStage.nm, 0.1, 0.8, dtFactor);

      const clampedCaliperNm = Math.max(minNm, Math.min(maxNm, caliperNmSpring.pos));
      const caliperPct = ((clampedCaliperNm - minNm) / nmSpan) * 100;

      if (caliperRef.current) {
        caliperRef.current.style.left = `${caliperPct.toFixed(2)}%`;
      }
      if (specActiveLabelRef.current) {
        specActiveLabelRef.current.textContent = `${clampedCaliperNm.toFixed(2)} nm`;
      }
      if (oscPathRef.current) {
        const d = buildOscilloscopeCurvePath({
          activeNm: clampedCaliperNm,
          spikeBoost: state.transitionEnergy,
          timeSec,
          width: 1000,
          height: 54,
          minNm,
          maxNm,
        });
        oscPathRef.current.setAttribute('d', d);
      }

      // 7. Procedural 60fps Optical Interferometer Standing-Wave Fringes (Strictly Behind Type)
      ctx2d.clearRect(0, 0, canvasW, canvasH);
      const isLightInk = activeStage.ink === '#F6F3EB';
      const inkRgb = isLightInk ? '246, 243, 235' : '17, 17, 20';

      // Spatial frequency shifts mathematically proportional to 1 / wavelength
      const waveK = (656.28 / Math.max(400, freqNmSpring.pos)) * 0.024;
      const fringeCount = 26;
      const shockR = state.shockfront.active
        ? (state.shockfront.radiusPct / 100) * cssCircleRefLen
        : -999;

      ctx2d.lineWidth = 0.85;
      for (let f = 0; f < fringeCount; f++) {
        const normY = (f + 0.5) / fringeCount;
        const baseY = normY * canvasH;
        const alpha = 0.12 + 0.09 * Math.sin(normY * Math.PI);
        ctx2d.strokeStyle = `rgba(${inkRgb}, ${alpha.toFixed(3)})`;
        ctx2d.beginPath();

        const stepX = 22;
        for (let x = 0; x <= canvasW + stepX; x += stepX) {
          const standing =
            Math.sin(x * waveK + timeSec * 1.15 + f * 0.45) *
            Math.cos(timeSec * 0.7 - f * 0.25) *
            (3.4 + state.transitionEnergy * 5.8);

          // Crisp radial optical refraction pulse as shockwave sweeps past
          let refraction = 0;
          if (state.shockfront.active) {
            const dist = Math.hypot(x - impactX, baseY - impactY);
            const ringDelta = dist - shockR;
            if (Math.abs(ringDelta) < 110) {
              const env = Math.exp(-(ringDelta * ringDelta) / (2 * 34 * 34));
              refraction =
                Math.sin(ringDelta * 0.14) * env * 14 * state.shockfront.strength;
            }
          }

          const y = baseY + standing + refraction;
          if (x === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }
        ctx2d.stroke();
      }

      // Subtle concentric radial optical refraction rings on canvas during impact
      if (state.shockfront.active && state.shockfront.strength > 0.04) {
        ctx2d.strokeStyle = `rgba(${inkRgb}, ${(0.22 * state.shockfront.strength).toFixed(3)})`;
        ctx2d.lineWidth = 1;
        for (let ring = 1; ring <= 3; ring++) {
          const rr = Math.max(4, shockR - ring * 26);
          ctx2d.beginPath();
          ctx2d.arc(impactX, impactY, rr, 0, Math.PI * 2);
          ctx2d.stroke();
        }
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
      resizeObserver.disconnect();
      observer.disconnect();
    };
  }, []);

  const handleTabJump = (stageIdx: number) => {
    const st = scrollTriggerRef.current;
    if (st) {
      const anchor = ACT2_TIMING.anchors[stageIdx] ?? 0.08;
      const targetY = st.start + (st.end - st.start) * anchor;
      motionEngine.scrollTo(targetY);
    } else {
      scrubProxyRef.current.progress = ACT2_TIMING.anchors[stageIdx] ?? 0.08;
      onSelectStage(stageIdx);
    }
  };

  const activeStage = CONTENT.act2.stages[activeStageIndex] ?? CONTENT.act2.stages[0];
  const isLightInk = activeStage.ink === '#F6F3EB';
  const chromeTextColor = activeStage.ink;
  const chromeBorderColor = isLightInk
    ? 'rgba(246, 243, 235, 0.5)'
    : 'rgba(17, 17, 20, 0.42)';

  return (
    <section
      ref={rootRef}
      id="act-2"
      data-act="2"
      data-act-ink={isLightInk ? 'light' : 'dark'}
      data-stage-id={activeStage.id}
      className="relative h-[100svh] min-h-[100svh] w-full overflow-hidden border-b border-[#111114]"
      style={{ backgroundColor: CONTENT.act2.stages[0].bg }}
    >
      {/* 1. STACKED 4 FULL-BLEED FLAT SPECTRAL COLOR PLATES (z: 1..4) */}
      {CONTENT.act2.stages.map((stage, idx) => (
        <div
          key={`bg-${stage.id}`}
          ref={(el) => {
            bgLayerRefs.current[idx] = el;
          }}
          data-testid={`act2-layer-${stage.id}`}
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: stage.bg,
            zIndex: idx + 1,
            clipPath: idx === 0 ? undefined : 'circle(0% at 50% 12%)',
          }}
        />
      ))}

      {/* 2. PROCEDURAL 60FPS OPTICAL INTERFEROMETER CANVAS (z: 10 — Strictly Behind Type) */}
      <canvas
        ref={interferometerCanvasRef}
        className="pointer-events-none absolute inset-0 z-[10] w-full h-full"
        aria-hidden="true"
        data-testid="act2-interferometer-canvas"
      />

      {/* 3. SYNCHRONIZED CLIPPED STAGE CONTENT LAYERS (z: 15..18 — Razor-Sharp Above Fringes) */}
      {CONTENT.act2.stages.map((stage, idx) => {
        const stageIsLight = stage.ink === '#F6F3EB';
        const strongBorder = stageIsLight ? 'border-[#F6F3EB]' : 'border-[#111114]';
        return (
          <div
            key={`content-${stage.id}`}
            ref={(el) => {
              contentLayerRefs.current[idx] = el;
            }}
            data-testid={`act2-content-${stage.id}`}
            className="pointer-events-none absolute inset-0"
            style={{
              color: stage.ink,
              zIndex: 15 + idx,
              clipPath: idx === 0 ? undefined : 'circle(0% at 50% 12%)',
            }}
          >
            {/* Bounded strictly inside the open visual band between top telemetry strip & bottom spectrometer */}
            <div className="absolute inset-x-0 top-[102px] sm:top-[114px] bottom-[126px] sm:bottom-[152px] flex flex-col justify-center px-4 sm:px-6 md:px-10">
              {/* Stage Telemetry Strip + Monumental 3D-Hinged Roboto Flex Headline */}
              <div className="relative w-full flex flex-col gap-3 sm:gap-5 md:gap-6">
                <div
                  className={`grid grid-cols-2 md:grid-cols-4 border ${strongBorder} arch-surface`}
                  style={{ backgroundColor: stage.bg }}
                >
                  <div className={`px-3 sm:px-4 py-1.5 sm:py-2.5 border-b md:border-b-0 border-r ${strongBorder}`}>
                    <span className="font-mono-lab text-[11px] sm:text-sm md:text-base font-bold tracking-[0.06em] block">
                      {stage.code}
                    </span>
                  </div>
                  <div className={`px-3 sm:px-4 py-1.5 sm:py-2.5 border-b md:border-b-0 md:border-r ${strongBorder}`}>
                    <span className="font-mono-lab text-[11px] sm:text-sm md:text-base font-bold tracking-[0.06em] block">
                      {stage.wavelength}
                    </span>
                  </div>
                  <div className={`px-3 sm:px-4 py-1.5 sm:py-2.5 border-r ${strongBorder}`}>
                    <span className="font-mono-lab text-[11px] sm:text-sm md:text-base tracking-[0.05em] block">
                      {stage.transition}
                    </span>
                  </div>
                  <div className="px-3 sm:px-4 py-1.5 sm:py-2.5">
                    <span className="font-mono-lab text-[11px] sm:text-sm md:text-base font-semibold tracking-[0.06em] block">
                      {stage.energy}
                    </span>
                  </div>
                </div>

                {/* Streak-Camera Kinetic Headline Container */}
                <div className="relative stage-hinge-perspective">
                  {/* Hollow Streak-Camera Ghost Trail 2 (farthest behind) */}
                  <div
                    ref={(el) => {
                      ghost2Refs.current[idx] = el;
                    }}
                    aria-hidden="true"
                    className="absolute inset-0 stage-headline k-font-roboto-flex uppercase break-words streak-ghost opacity-0"
                  >
                    {stage.title}
                  </div>

                  {/* Hollow Streak-Camera Ghost Trail 1 (closer) */}
                  <div
                    ref={(el) => {
                      ghost1Refs.current[idx] = el;
                    }}
                    aria-hidden="true"
                    className="absolute inset-0 stage-headline k-font-roboto-flex uppercase break-words streak-ghost opacity-0"
                  >
                    {stage.title}
                  </div>

                  {/* Solid Primary Center-Out Erupting Roboto Flex Headline */}
                  <h2
                    data-solid-headline="true"
                    data-testid={`act2-headline-${stage.id}`}
                    className="relative stage-headline k-font-roboto-flex uppercase break-words doppler-heading"
                  >
                    <KineticText text={stage.title} font="roboto-flex" />
                  </h2>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 4. CENTER 1px LITHIUM-DROP SPINE + FLAT SEGMENTED WAKE + PELLET + 2 SVG SHOCKFRONT RINGS */}
      <div
        className="pointer-events-none absolute inset-0 z-[22]"
        aria-hidden="true"
      >
        {/* Center vertical 1px spine */}
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px"
          style={{ backgroundColor: chromeTextColor, opacity: 0.32 }}
        />

        {/* Flat Segmented Plasma Wake Trail (zero gradients) */}
        <div
          ref={wakeRef}
          className="absolute left-1/2 -translate-x-1/2 w-[3px] flex flex-col justify-between overflow-hidden"
          style={{
            top: '12%',
            height: '2%',
          }}
        >
          <span className="block w-full h-[22%] opacity-15" style={{ backgroundColor: chromeTextColor }} />
          <span className="block w-full h-[24%] opacity-30" style={{ backgroundColor: chromeTextColor }} />
          <span className="block w-full h-[26%] opacity-50" style={{ backgroundColor: chromeTextColor }} />
          <span className="block w-full h-[24%] opacity-75" style={{ backgroundColor: chromeTextColor }} />
        </div>

        {/* Dropping Geometric Diamond Lithium Pellet */}
        <div
          ref={pelletGroupRef}
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ top: '12%' }}
          data-testid="lithium-pellet"
        >
          <svg width="26" height="26" viewBox="0 0 26 26">
            <polygon
              points="13,2 24,13 13,24 2,13"
              fill={chromeTextColor}
              stroke={activeStage.bg}
              strokeWidth="1.5"
            />
            <polygon points="13,7.5 18.5,13 13,18.5 7.5,13" fill={activeStage.bg} />
          </svg>
        </div>

        {/* 2 Concentric High-Contrast SVG Shockfront Rings + Live Radius Readout */}
        <svg
          ref={shockSvgRef}
          className="absolute inset-0 w-full h-full opacity-0"
          data-testid="act2-shockfront-svg"
        >
          <circle
            ref={shockRingOuterRef}
            cx="50%"
            cy="50%"
            r="0"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
          <circle
            ref={shockRingInnerRef}
            cx="50%"
            cy="50%"
            r="0"
            fill="none"
            stroke={chromeTextColor}
            strokeWidth="1.25"
            strokeDasharray="6 6"
          />
          <text
            ref={shockLabelRef}
            x="50%"
            y="50%"
            fill={chromeTextColor}
            fontSize="11"
            className="font-mono-lab"
          >
            R: 0.0mm
          </text>
        </svg>
      </div>

      {/* 4. TOP TELEMETRY RAIL: EYEBROW + LIVE MICROSECOND CLOCK + INTERACTIVE STAGE TABS */}
      <div
        className="relative z-[30] w-full px-4 sm:px-6 md:px-10 pt-11 sm:pt-14"
        style={{ color: chromeTextColor }}
      >
        <div
          className="w-full border-t pt-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5"
          style={{ borderColor: chromeBorderColor }}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono-lab text-[10px] sm:text-xs tracking-[0.08em]">
            <span>{CONTENT.act2.eyebrow}</span>
            <span
              className="px-2 py-0.5 border arch-surface font-bold"
              style={{ borderColor: chromeTextColor }}
              data-testid="act2-time-readout"
            >
              T+ <span ref={timeReadoutRef}>00.000 ms</span>
            </span>
          </div>

          <div
            className="grid grid-cols-2 sm:inline-flex items-stretch border arch-surface"
            style={{ borderColor: chromeTextColor, backgroundColor: activeStage.bg }}
            role="group"
            aria-label="Spectral emission stage selector"
          >
            {CONTENT.act2.stages.map((item, idx) => {
              const isActive = idx === activeStageIndex;
              const mobileBorderClass = `${idx % 2 === 0 ? 'border-r' : ''} ${
                idx < 2 ? 'border-b' : ''
              } sm:border-b-0 sm:border-r sm:last:border-r-0`;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleTabJump(idx)}
                  className={`font-mono-lab text-[11px] sm:text-xs font-medium tracking-[0.05em] px-3 sm:px-4 min-h-[34px] sm:min-h-[38px] arch-surface whitespace-nowrap shrink-0 cursor-pointer ${mobileBorderClass}`}
                  style={{
                    borderColor: chromeTextColor,
                    backgroundColor: isActive ? chromeTextColor : 'transparent',
                    color: isActive ? activeStage.bg : chromeTextColor,
                  }}
                >
                  {item.tabLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. BOTTOM LIVE FRAUNHOFER / BALMER EMISSION SPECTROMETER + OSCILLOSCOPE ANALYZER */}
      <div
        className="absolute bottom-10 sm:bottom-14 left-0 right-0 z-[30] px-4 sm:px-6 md:px-10"
        style={{ color: chromeTextColor }}
      >
        <div
          className="border arch-surface px-3 sm:px-5 pt-1.5 pb-2"
          style={{ borderColor: chromeTextColor, backgroundColor: activeStage.bg }}
          data-testid="emission-spectrometer"
        >
          {/* Live SVG Oscilloscope Spectral Intensity Curve */}
          <div className="relative h-9 sm:h-12 w-full border-b" style={{ borderColor: chromeBorderColor }}>
            <svg
              viewBox="0 0 1000 54"
              preserveAspectRatio="none"
              className="w-full h-full block"
              aria-hidden="true"
              data-testid="act2-oscilloscope-svg"
            >
              <line
                x1="0"
                y1="50"
                x2="1000"
                y2="50"
                stroke={chromeTextColor}
                strokeOpacity="0.25"
                strokeWidth="1"
              />
              <path
                ref={oscPathRef}
                d={buildOscilloscopeCurvePath({ activeNm: activeStage.nm })}
                fill="none"
                stroke={chromeTextColor}
                strokeWidth="1.75"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          {/* 380nm–700nm Calibrated Fraunhofer/Balmer Barcode + Magnetic Optical Caliper */}
          <div className="relative h-10 sm:h-12 w-full">
            {fraunhoferTicks.map((tick) => {
              const isSelectedEmission = tick.stageId === activeStage.id;
              return (
                <div
                  key={`${tick.nm}-${tick.isEmission ? 'e' : 'g'}`}
                  className="absolute bottom-0 top-0 -translate-x-1/2 flex flex-col items-center justify-end"
                  style={{ left: `${tick.positionPct}%` }}
                >
                  <span
                    className="block arch-surface"
                    style={{
                      width: isSelectedEmission ? '3px' : tick.isEmission ? '2px' : '1px',
                      height: isSelectedEmission
                        ? '100%'
                        : tick.isEmission
                          ? '82%'
                          : tick.isMajorScale
                            ? '46%'
                            : '26%',
                      backgroundColor: chromeTextColor,
                      opacity: isSelectedEmission
                        ? 1
                        : tick.isEmission
                          ? 0.72
                          : tick.isMajorScale
                            ? 0.34
                            : 0.18,
                    }}
                  />
                </div>
              );
            })}

            {/* Precision Magnetically Sliding Optical Caliper Bracket */}
            <div
              ref={caliperRef}
              className="pointer-events-none absolute -top-1 bottom-0 w-4 -translate-x-1/2 border-x-2 border-t-2 arch-surface"
              style={{
                left: '86.34%',
                borderColor: chromeTextColor,
              }}
              data-testid="spectrometer-caliper"
            />
          </div>

          {/* Atomic Peak Reference Labels & 380nm–700nm Bounds */}
          <div className="mt-1.5 flex items-center justify-between gap-2 font-mono-lab text-[10px] sm:text-xs tracking-[0.06em]">
            <span>{CONTENT.act2.spectrometerBounds.minLabel}</span>
            <div className="hidden md:flex items-center gap-4 text-[10px] opacity-80">
              {ATOMIC_EMISSION_PEAKS.map((peak) => (
                <span
                  key={peak.label}
                  className={peak.stageId === activeStage.id ? 'font-bold opacity-100 underline underline-offset-4' : ''}
                >
                  {peak.label}
                </span>
              ))}
            </div>
            <span ref={specActiveLabelRef} className="font-bold">
              {activeStage.wavelength}
            </span>
            <span>{CONTENT.act2.spectrometerBounds.maxLabel}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
