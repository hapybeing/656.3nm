import React, { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONTENT, type SpectralStage } from '../data/content';
import { motionEngine } from '../engine/motionEngine';
import { spectralAudio } from '../engine/spectralAudio';
import { stepSpring, type SpringState } from '../physics/motionMath';
import {
  ACT2_TIMING,
  buildOscilloscopeCurvePath,
  computeAct2ScrollState,
  computeCenterOutCharPose,
  generateFraunhoferSpectrometer,
} from '../physics/spectroscopyMath';
import { KineticText } from './KineticText';
import { Act2Lithium3D, type Act2VisualState } from './three/Act2Lithium3D';

gsap.registerPlugin(ScrollTrigger);

export interface Act2LithiumProps {
  activeStageIndex: number;
  onSelectStage: (index: number) => void;
}

/**
 * ACT 02 — DROP THE LITHIUM (16,000 FPS Optical Shockwave Chamber + 3D Lithium Impact)
 * Brutally decluttered 3-row CSS Grid spanning 100svh:
 * - 4 full-bleed stacked spectral surfaces (#FF1F71 -> #FF2A2A -> #00E676 -> #00D8FF)
 * - GPU-composited radial clip-path shockwave wipes + crisp SVG shockfront rings
 * - Sculptural 3D WebGL Lithium Crystal + Ionized Shards + Twisted Plasma Vortex + 3D Shockwave Rings
 * - Row 1: Pure high-contrast live T+ 00.000 ms badge + 4 crisp wavelength tabs ONLY
 * - Row 2 (1fr): Massive center-out 3D-hinge Roboto Flex headline + hollow streak-camera ghosts
 * - Row 3: Clean live oscilloscope emission peak curve + Fraunhofer caliper
 * Zero muted eyebrow text, zero 01/04 counter, zero metadata clutter, zero 2D grey canvas lines.
 */
export const Act2Lithium: React.FC<Act2LithiumProps> = ({
  activeStageIndex,
  onSelectStage,
}) => {
  const rootRef = useRef<HTMLElement | null>(null);
  const stageRowRef = useRef<HTMLDivElement | null>(null);
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);

  // Stacked flat spectral color plates (layers 1..3 animate GPU clip-path circle wipes)
  const bgLayerRefs = useRef<Array<HTMLDivElement | null>>([]);
  // Synchronized clipped stage content layers inside dedicated Row 2 (1fr)
  const contentLayerRefs = useRef<Array<HTMLDivElement | null>>([]);
  // Per-stage headline & streak-camera ghost refs
  const stageCharGroupsRef = useRef<Array<HTMLElement[]>>([[], [], [], []]);
  const ghost1Refs = useRef<Array<HTMLDivElement | null>>([]);
  const ghost2Refs = useRef<Array<HTMLDivElement | null>>([]);

  // Concentric high-contrast SVG shockfront rings
  const shockSvgRef = useRef<SVGSVGElement | null>(null);
  const shockRingOuterRef = useRef<SVGCircleElement | null>(null);
  const shockRingInnerRef = useRef<SVGCircleElement | null>(null);

  // Direct-DOM live telemetry & bottom emission curve refs
  const timeReadoutRef = useRef<HTMLSpanElement | null>(null);
  const oscPathRef = useRef<SVGPathElement | null>(null);
  const caliperRef = useRef<HTMLDivElement | null>(null);
  const specActiveLabelRef = useRef<HTMLSpanElement | null>(null);

  // Mutable 60fps progress, 3D visual state, & discrete stage ref (zero useState churn)
  const scrubProxyRef = useRef({ progress: 0 });
  const visual3DRef = useRef<Act2VisualState>({
    progress: 0,
    stageIndex: 0,
    pelletYPct: 12,
    transitionEnergy: 0,
    shockNonce: 0,
  });
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
    if (!root) return;

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

    let rootW = 1;
    let rootH = 1;
    let row2TopOffset = 90;
    const measureBounds = () => {
      const rect = root.getBoundingClientRect();
      rootW = Math.max(1, Math.round(rect.width));
      rootH = Math.max(1, Math.round(rect.height));
      if (stageRowRef.current) {
        row2TopOffset = stageRowRef.current.getBoundingClientRect().top - rect.top;
      }
    };
    measureBounds();
    const resizeObserver = new ResizeObserver(measureBounds);
    resizeObserver.observe(root);
    if (stageRowRef.current) resizeObserver.observe(stageRowRef.current);
    window.addEventListener('resize', measureBounds, { passive: true });

    const caliperNmSpring: SpringState = {
      pos: CONTENT.act2.stages[0].nm,
      vel: 0,
    };
    const ghostOffsetSpring: SpringState = { pos: 0, vel: 0 };

    let prevProgress = -1;
    let rafId = 0;
    let lastTs = performance.now();

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

      // Feed live physics directly into Act2Lithium3D mutable ref (zero React setState)
      visual3DRef.current.progress = progress;
      visual3DRef.current.stageIndex = state.activeStageIndex;
      visual3DRef.current.pelletYPct = state.pelletYPct;
      visual3DRef.current.transitionEnergy = state.transitionEnergy;

      // Notify parent + launch 3D torus shockwave ring ONLY on discrete stage crossing
      if (state.activeStageIndex !== lastDiscreteStageRef.current) {
        lastDiscreteStageRef.current = state.activeStageIndex;
        visual3DRef.current.shockNonce += 1;
        onSelectStageRef.current(state.activeStageIndex);
        spectralAudio.playIonizationChime(activeStage.nm);
      }

      // 1. Live reactor microsecond clock
      const timeText = `${state.timeMs.toFixed(3).padStart(6, '0')} ms`;
      if (timeReadoutRef.current && timeText !== lastTimeText) {
        lastTimeText = timeText;
        timeReadoutRef.current.textContent = timeText;
      }

      const cssCircleRefLen = Math.hypot(rootW, rootH) / Math.SQRT2;
      const impactX = rootW * 0.5;
      const impactY = (rootH * state.pelletYPct) / 100;

      // 2. Synchronized GPU radial clip-path wipes
      for (let i = 1; i <= 3; i++) {
        const rPct = state.layerClipRadiiPct[i];
        const rPx = (rPct / 100) * cssCircleRefLen;
        const key = `${rPx.toFixed(1)}@${impactY.toFixed(1)}@${row2TopOffset.toFixed(1)}@${rootW}`;
        if (key !== lastClipKeys[i]) {
          lastClipKeys[i] = key;
          const bgClip = `circle(${rPx.toFixed(1)}px at ${impactX.toFixed(1)}px ${impactY.toFixed(1)}px)`;
          const stageClip = `circle(${rPx.toFixed(1)}px at ${impactX.toFixed(1)}px ${(impactY - row2TopOffset).toFixed(1)}px)`;
          const bgLayer = bgLayerRefs.current[i];
          if (bgLayer) bgLayer.style.clipPath = bgClip;
          const contentLayer = contentLayerRefs.current[i];
          if (contentLayer) contentLayer.style.clipPath = stageClip;
        }
      }

      // Cross-fade outgoing stage content cleanly before incoming shockwave
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

      // 3. Concentric high-contrast SVG shockfront rings riding on wipe seam
      if (
        shockSvgRef.current &&
        shockRingOuterRef.current &&
        shockRingInnerRef.current
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
        } else {
          shockSvgRef.current.style.opacity = '0';
        }
      }

      // 4. Center-out 3D-hinge variable typography + streak-camera ghost trails
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

      // 5. Live Bottom Emission Peak Curve + Magnetic Caliper
      stepSpring(caliperNmSpring, activeStage.nm, 0.14, 0.74, dtFactor);
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
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', measureBounds);
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

  return (
    <section
      ref={rootRef}
      id="act-2"
      data-act="2"
      data-act-ink={isLightInk ? 'light' : 'dark'}
      data-stage-id={activeStage.id}
      className="relative h-[100svh] min-h-[100svh] w-full max-w-full overflow-hidden box-border pt-[3.25rem] pb-[1.5rem] grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto]"
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
            clipPath: idx === 0 ? undefined : 'circle(0px at 50% 12%)',
          }}
        />
      ))}

      {/* 2. SCULPTURAL 3D LITHIUM CRYSTAL IMPACT & PLASMA VORTEX (z: 6 — Vividly behind Row 2 Type) */}
      <Act2Lithium3D
        stateRef={visual3DRef}
        className="absolute inset-0 z-[6] w-full h-full"
      />

      {/* 3. HIGH-CONTRAST SVG SHOCKFRONT RINGS RIDING WIPE SEAM (z: 7) */}
      <svg
        ref={shockSvgRef}
        className="pointer-events-none absolute inset-0 z-[7] w-full h-full opacity-0"
        data-testid="act2-shockfront-svg"
        aria-hidden="true"
      >
        <circle
          ref={shockRingOuterRef}
          cx="50%"
          cy="50%"
          r="0"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.5"
        />
        <circle
          ref={shockRingInnerRef}
          cx="50%"
          cy="50%"
          r="0"
          fill="none"
          stroke={chromeTextColor}
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
      </svg>

      {/* ROW 1: PURE HIGH-CONTRAST T+ CLOCK + 4 WAVELENGTH TABS ONLY (ZERO GREY CLUTTER) */}
      <div
        className="relative z-[30] w-full min-w-0 px-4 sm:px-6 md:px-10 pt-1"
        style={{ color: chromeTextColor }}
        data-testid="act2-header-row"
      >
        <div className="w-full min-w-0 flex flex-wrap items-center justify-between gap-2">
          <span
            className="px-2 py-1 border-2 arch-surface font-mono-lab text-[10px] sm:text-xs font-bold tracking-[0.07em] whitespace-nowrap shrink-0"
            style={{ borderColor: chromeTextColor, backgroundColor: activeStage.bg }}
            data-testid="act2-time-readout"
          >
            T+ <span ref={timeReadoutRef}>00.000 ms</span>
          </span>

          <div
            className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex items-stretch border-2 arch-surface shrink-0 mr-0 sm:mr-6"
            style={{ borderColor: chromeTextColor, backgroundColor: activeStage.bg }}
            role="group"
            aria-label="Spectral emission stage selector"
          >
            {CONTENT.act2.stages.map((item, idx) => {
              const isActive = idx === activeStageIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleTabJump(idx)}
                  className="font-mono-lab text-[9.5px] sm:text-[11px] font-bold tracking-[0.03em] px-1.5 sm:px-3 min-h-[28px] sm:min-h-[30px] arch-surface whitespace-nowrap text-center cursor-pointer border-r-2 last:border-r-0"
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

      {/* ROW 2 (1fr): DEDICATED OPEN TYPOGRAPHY STAGE OVER 3D LITHIUM VORTEX */}
      <div
        ref={stageRowRef}
        className="relative z-[20] min-h-0 min-w-0 w-full overflow-visible"
        data-testid="act2-typography-row"
      >
        {CONTENT.act2.stages.map((stage, idx) => (
          <div
            key={`content-${stage.id}`}
            ref={(el) => {
              contentLayerRefs.current[idx] = el;
            }}
            data-testid={`act2-content-${stage.id}`}
            className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 sm:px-6 md:px-10"
            style={{
              color: stage.ink,
              zIndex: 20 + idx,
              clipPath: idx === 0 ? undefined : 'circle(0px at 50% 0px)',
            }}
          >
            <div className="relative w-full max-w-full stage-hinge-perspective text-center">
              {/* Hollow Streak-Camera Ghost Trail 2 */}
              <div
                ref={(el) => {
                  ghost2Refs.current[idx] = el;
                }}
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center stage-headline k-font-roboto-flex uppercase text-center break-words streak-ghost opacity-0"
              >
                {stage.title}
              </div>

              {/* Hollow Streak-Camera Ghost Trail 1 */}
              <div
                ref={(el) => {
                  ghost1Refs.current[idx] = el;
                }}
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center stage-headline k-font-roboto-flex uppercase text-center break-words streak-ghost opacity-0"
              >
                {stage.title}
              </div>

              {/* Solid Primary Center-Out Erupting Roboto Flex Headline */}
              <h2
                data-solid-headline="true"
                data-testid={`act2-headline-${idx}`}
                className="relative stage-headline k-font-roboto-flex uppercase text-center break-words doppler-heading"
              >
                <KineticText text={stage.title} font="roboto-flex" />
              </h2>
            </div>
          </div>
        ))}
      </div>

      {/* ROW 3: CLEAN LIVE EMISSION PEAK CURVE & CALIPER */}
      <div
        className="relative z-[10] w-full min-w-0 px-4 sm:px-6 md:px-10 pr-7 sm:pr-10 md:pr-12"
        style={{ color: chromeTextColor }}
      >
        <div
          className="h-[clamp(62px,11.5svh,94px)] border-2 arch-surface px-3 sm:px-4 py-1.5 flex flex-col justify-between"
          style={{ borderColor: chromeTextColor, backgroundColor: activeStage.bg }}
          data-testid="emission-spectrometer"
        >
          {/* Live SVG Oscilloscope Spectral Intensity Curve */}
          <div className="relative flex-1 min-h-[22px] w-full">
            <svg
              viewBox="0 0 1000 54"
              preserveAspectRatio="none"
              className="w-full h-full block"
              aria-hidden="true"
              data-testid="act2-oscilloscope-svg"
            >
              <path
                ref={oscPathRef}
                d={buildOscilloscopeCurvePath({ activeNm: activeStage.nm })}
                fill="none"
                stroke={chromeTextColor}
                strokeWidth="2.2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          {/* High-Contrast Emission Barcode + Sliding Caliper */}
          <div className="relative h-3.5 w-full">
            {fraunhoferTicks
              .filter((t) => t.isEmission || t.isMajorScale)
              .map((tick) => {
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
                        height: isSelectedEmission ? '100%' : tick.isEmission ? '78%' : '45%',
                        backgroundColor: chromeTextColor,
                      }}
                    />
                  </div>
                );
              })}

            <div
              ref={caliperRef}
              className="pointer-events-none absolute -top-0.5 bottom-0 w-3.5 -translate-x-1/2 border-x-2 border-t-2 arch-surface"
              style={{
                left: '86.34%',
                borderColor: chromeTextColor,
              }}
              data-testid="spectrometer-caliper"
            />
          </div>

          {/* Crisp Bounds + Live Active Wavelength */}
          <div className="pt-0.5 flex items-center justify-between gap-2 font-mono-lab text-[9.5px] sm:text-[11px] font-bold leading-none tracking-[0.06em] whitespace-nowrap">
            <span className="shrink-0">{CONTENT.act2.spectrometerBounds.minLabel}</span>
            <span ref={specActiveLabelRef} className="whitespace-nowrap shrink-0">
              {activeStage.wavelength}
            </span>
            <span className="shrink-0">{CONTENT.act2.spectrometerBounds.maxLabel}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
