import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { CONTENT } from '../data/content';
import { spectralAudio } from '../engine/spectralAudio';
import {
  generateDialArcPath,
  generateDialTicks,
  polarToCartesian,
} from '../physics/geometry';
import {
  buildFusionBurnWavePaths,
  computeLawsonTelemetry,
  computeThermalStress,
  getSpectralSegmentColor,
  LAWSON_DIAL_CONFIGS,
  normToValue,
  shortestAngleDelta,
  stepDialInertia,
  valueToNorm,
  type DialInertiaState,
} from '../physics/lawsonMath';
import { clamp } from '../physics/motionMath';
import { KineticText } from './KineticText';

export interface Act4IgnitionProps {
  onIgnitedChange?: (ignited: boolean) => void;
}

const SEGMENT_COUNT = 24;

function formatDialValue(idx: number, val: number): string {
  if (idx === 0) return `${val.toFixed(2)} × 10²⁰`;
  if (idx === 1) return val.toFixed(1);
  return val.toFixed(2);
}

/**
 * ACT 04 — THE IGNITION INSTRUMENT (Lawson Criterion n · T · τE)
 * Full-bleed Dieter Rams lab console with:
 * - 3 rotational-inertia SVG instrument dials (angular drag, vertical fallback, wheel, flick momentum, 6° magnetic detents)
 * - Real Lawson Triple Product (keV·s·m^-3) & Fusion Gain Q calculation at 60fps via direct DOM refs
 * - Pre-ignition thermal stress (0.65..0.99 Q: micro-jitter, variable-axis flare, Balmer RGB aberration, tightening crosshairs)
 * - Breakeven X-Ray Flash (Q >= 1.00): 260ms blinding #FFFFFF overexposure flash + circular shockfront ring + console recoil
 * - Inverted Carbon Tungsten (#111114) self-sustaining burning equilibrium + live 60fps double-harmonic burn waveform
 * - Reversible quench when dialing back below Q = 1.00 or clicking [ QUENCH ↓ ]
 */
export const Act4Ignition: React.FC<Act4IgnitionProps> = ({ onIgnitedChange }) => {
  const [isIgnited, setIsIgnited] = useState(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const headlineRef = useRef<HTMLHeadingElement | null>(null);

  // Fullscreen fixed 260ms blinding pure-white X-Ray overexposure flash + shockfront ring refs
  const xrayFlashRef = useRef<HTMLDivElement | null>(null);
  const xrayRingRef = useRef<SVGCircleElement | null>(null);
  const xraySvgRef = useRef<SVGSVGElement | null>(null);

  // Per-dial direct-DOM SVG & readout refs (zero React re-renders at 60fps)
  const dialSvgRefs = useRef<Array<SVGSVGElement | null>>([]);
  const dialArcRefs = useRef<Array<SVGPathElement | null>>([]);
  const dialNeedleRefs = useRef<Array<SVGLineElement | null>>([]);
  const dialTipRefs = useRef<Array<SVGCircleElement | null>>([]);
  const dialCrosshairRefs = useRef<Array<SVGGElement | null>>([]);
  const dialValueRefs = useRef<Array<SVGTextElement | null>>([]);

  // Bottom bar, live telemetry & phase-locked burn waveform refs
  const tripleProductRef = useRef<HTMLSpanElement | null>(null);
  const qReadoutRef = useRef<HTMLSpanElement | null>(null);
  const segmentRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const burnWavePrimaryRef = useRef<SVGPathElement | null>(null);
  const burnWaveHarmonicRef = useRef<SVGPathElement | null>(null);

  // Mutable 60fps physics state (zero useState in rAF or drag loops)
  const dialStatesRef = useRef<DialInertiaState[]>(
    LAWSON_DIAL_CONFIGS.map((cfg) => {
      const norm = valueToNorm(cfg.defaultVal, cfg);
      return { norm, vel: 0, detentIdx: Math.round(norm * 60) };
    })
  );
  const dragInfoRef = useRef<{
    dialIdx: number;
    pointerId: number;
    cx: number;
    cy: number;
    lastAngle: number;
    lastClientY: number;
  } | null>(null);
  const autoTweenRef = useRef<gsap.core.Tween | null>(null);
  const ignitedRef = useRef(false);
  const onIgnitedChangeRef = useRef(onIgnitedChange);
  onIgnitedChangeRef.current = onIgnitedChange;

  const ticks = useMemo(() => generateDialTicks(150, 150, 132, 60), []);

  // Trigger the 260ms blinding pure-white X-ray overexposure flash + shockfront ring + 3px recoil
  const triggerXRayClimax = () => {
    spectralAudio.playIgnitionXRayChord();

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    if (xrayFlashRef.current) {
      gsap.killTweensOf(xrayFlashRef.current);
      gsap
        .timeline()
        .set(xrayFlashRef.current, { visibility: 'visible', opacity: 0 })
        .to(xrayFlashRef.current, { opacity: 1, duration: 0.035, ease: 'power4.out' })
        .to(xrayFlashRef.current, {
          opacity: 0,
          duration: 0.24,
          ease: 'expo.out',
          onComplete: () => {
            if (xrayFlashRef.current) {
              xrayFlashRef.current.style.visibility = 'hidden';
            }
          },
        });
    }

    if (xraySvgRef.current && xrayRingRef.current) {
      const ringEl = xrayRingRef.current;
      const svgEl = xraySvgRef.current;
      const maxR = Math.hypot(window.innerWidth, window.innerHeight) * 0.65;
      const proxy = { r: 24, opacity: 0.95 };
      gsap.killTweensOf(proxy);
      svgEl.style.visibility = 'visible';
      gsap.to(proxy, {
        r: maxR,
        opacity: 0,
        duration: 0.42,
        ease: 'expo.out',
        onUpdate: () => {
          ringEl.setAttribute('r', proxy.r.toFixed(1));
          ringEl.setAttribute('stroke-opacity', proxy.opacity.toFixed(3));
        },
        onComplete: () => {
          svgEl.style.visibility = 'hidden';
        },
      });
    }

    if (consoleRef.current) {
      gsap.killTweensOf(consoleRef.current);
      gsap
        .timeline()
        .to(consoleRef.current, { y: 3, duration: 0.045, ease: 'power4.out' })
        .to(consoleRef.current, { y: 0, duration: 0.36, ease: 'elastic.out(1.1, 0.45)' });
    }
  };

  // Dedicated 60fps Lawson physics & instrument render loop (paused offscreen via IntersectionObserver)
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let isVisible = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisible = entry.isIntersecting;
        }
      },
      { threshold: 0.01, rootMargin: '120px 0px 120px 0px' }
    );
    observer.observe(section);

    // Dirty-check caches to avoid redundant DOM & font writes when settled
    const lastNorms = [-1, -1, -1];
    let lastStressKey = '';
    let lastTripleText = '';
    let lastQText = '';
    let lastFilledCount = -1;
    let lastIgnitedBarState: boolean | null = null;

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (!isVisible && !autoTweenRef.current) {
        lastTs = now;
        return;
      }

      const dtMs = Math.min(48, Math.max(4, now - lastTs));
      lastTs = now;
      const dtFactor = dtMs / 16.6667;
      const timeSec = now * 0.001;

      const states = dialStatesRef.current;
      const draggingIdx = dragInfoRef.current?.dialIdx ?? -1;

      // 1. Step rotational inertia & 6° magnetic detent ticks on all 3 dials
      let anyMoved = false;
      for (let i = 0; i < 3; i++) {
        const isDraggingThis = draggingIdx === i;
        const isAutoTweening = autoTweenRef.current !== null;
        const crossedDetent = stepDialInertia(
          states[i],
          dtFactor,
          isDraggingThis || isAutoTweening
        );
        if (crossedDetent) {
          spectralAudio.playDialDetentTick(i);
        }

        if (Math.abs(states[i].norm - lastNorms[i]) > 0.0004) {
          lastNorms[i] = states[i].norm;
          anyMoved = true;

          const norm = states[i].norm;
          const val = normToValue(norm, LAWSON_DIAL_CONFIGS[i]);
          const visualProgress = clamp(0.03 + norm * 0.94, 0.03, 0.97);
          const angleDeg = visualProgress * 360;
          const tip = polarToCartesian(150, 150, 104, angleDeg);
          const base = polarToCartesian(150, 150, 68, angleDeg);

          const arcEl = dialArcRefs.current[i];
          if (arcEl) {
            arcEl.setAttribute('d', generateDialArcPath(150, 150, 108, visualProgress));
          }
          const needleEl = dialNeedleRefs.current[i];
          if (needleEl) {
            needleEl.setAttribute('x1', base.x.toFixed(2));
            needleEl.setAttribute('y1', base.y.toFixed(2));
            needleEl.setAttribute('x2', tip.x.toFixed(2));
            needleEl.setAttribute('y2', tip.y.toFixed(2));
          }
          const tipEl = dialTipRefs.current[i];
          if (tipEl) {
            tipEl.setAttribute('cx', tip.x.toFixed(2));
            tipEl.setAttribute('cy', tip.y.toFixed(2));
          }
          const valEl = dialValueRefs.current[i];
          if (valEl) {
            valEl.textContent = formatDialValue(i, val);
          }
          const svgEl = dialSvgRefs.current[i];
          if (svgEl) {
            svgEl.setAttribute('aria-valuenow', val.toFixed(2));
          }
        }
      }

      // 2. Compute live Lawson Triple Product & Fusion Gain Q
      const nVal = normToValue(states[0].norm, LAWSON_DIAL_CONFIGS[0]);
      const tVal = normToValue(states[1].norm, LAWSON_DIAL_CONFIGS[1]);
      const tauVal = normToValue(states[2].norm, LAWSON_DIAL_CONFIGS[2]);
      const telemetry = computeLawsonTelemetry(nVal, tVal, tauVal);

      // 3. Detect discrete breakeven ignition crossing (Q >= 1.00) or reversible quench
      if (telemetry.isIgnited !== ignitedRef.current) {
        ignitedRef.current = telemetry.isIgnited;
        setIsIgnited(telemetry.isIgnited);
        onIgnitedChangeRef.current?.(telemetry.isIgnited);
        if (telemetry.isIgnited) {
          triggerXRayClimax();
        } else {
          spectralAudio.playQuenchCool();
        }
      }

      // Subtle rising harmonic tension while approaching breakeven during active interaction
      if (anyMoved && telemetry.qGain >= 0.7 && telemetry.qGain < 1.0) {
        spectralAudio.pulseIgnitionTension(telemetry.qGain);
      }

      // 4. Update tabular Triple Product & Q status readouts
      const tripleText = `P = ${telemetry.tripleProduct10e21.toFixed(2)} × 10²¹ keV·s·m⁻³  //  T = ${telemetry.temperatureKeV.toFixed(1)} keV`;
      if (tripleProductRef.current && tripleText !== lastTripleText) {
        lastTripleText = tripleText;
        tripleProductRef.current.textContent = tripleText;
      }

      const qLabel = telemetry.isIgnited
        ? `Q = ${telemetry.qGain.toFixed(2)}  //  IGNITION — SELF-SUSTAINING BURN`
        : telemetry.qGain >= 0.85
          ? `Q = ${telemetry.qGain.toFixed(2)}  //  CRITICAL THRESHOLD`
          : `Q = ${telemetry.qGain.toFixed(2)}  //  BREAKEVEN`;
      if (qReadoutRef.current && qLabel !== lastQText) {
        lastQText = qLabel;
        qReadoutRef.current.textContent = qLabel;
      }

      // 5. Update 24-segment spectral progression bar
      const filledCount = Math.round(telemetry.barFillRatio * SEGMENT_COUNT);
      if (
        filledCount !== lastFilledCount ||
        telemetry.isIgnited !== lastIgnitedBarState
      ) {
        lastFilledCount = filledCount;
        lastIgnitedBarState = telemetry.isIgnited;
        for (let s = 0; s < SEGMENT_COUNT; s++) {
          const seg = segmentRefs.current[s];
          if (!seg) continue;
          if (s < filledCount) {
            seg.style.backgroundColor = getSpectralSegmentColor(s, SEGMENT_COUNT);
          } else {
            seg.style.backgroundColor = 'transparent';
          }
        }
      }

      // 6. Pre-ignition thermal stress (0.65..0.99 Q) vs Serene Harmonic Lock (Q >= 1.00)
      const stress = computeThermalStress(telemetry.qGain);
      if (headlineRef.current) {
        const hs = headlineRef.current.style;
        const stressKey = `${stress.wdth}|${stress.wght}|${stress.chromaPx}`;
        if (stressKey !== lastStressKey) {
          lastStressKey = stressKey;
          hs.setProperty('--ign-wdth', String(stress.wdth));
          hs.setProperty('--ign-wght', String(stress.wght));
          hs.setProperty('--ign-chroma', `${stress.chromaPx}px`);
        }

        if (stress.jitterPx > 0.05) {
          const jx =
            (Math.sin(timeSec * 58) * 0.65 + Math.cos(timeSec * 97) * 0.35) *
            stress.jitterPx;
          const jy =
            (Math.cos(timeSec * 64) * 0.65 + Math.sin(timeSec * 103) * 0.35) *
            stress.jitterPx *
            0.55;
          hs.transform = `translate3d(${jx.toFixed(2)}px, ${jy.toFixed(2)}px, 0)`;
        } else if (hs.transform !== '') {
          hs.transform = '';
        }
      }

      // Tighten geometric plasma resonance crosshair arcs around the 3 dials
      for (let i = 0; i < 3; i++) {
        const ch = dialCrosshairRefs.current[i];
        if (!ch) continue;
        const rot = telemetry.isIgnited
          ? (timeSec * 18 * (i % 2 === 0 ? 1 : -1)) % 360
          : stress.stress * 22 * (i % 2 === 0 ? 1 : -1);
        ch.setAttribute(
          'transform',
          `translate(150 150) scale(${stress.crosshairScale}) rotate(${rot.toFixed(1)}) translate(-150 -150)`
        );
      }

      // 7. Live 60fps Phase-Locked Fusion Burn Waveform when ignited (Q >= 1.00)
      if (
        telemetry.isIgnited &&
        burnWavePrimaryRef.current &&
        burnWaveHarmonicRef.current
      ) {
        const { primary, harmonic } = buildFusionBurnWavePaths({
          qGain: telemetry.qGain,
          timeSec,
          width: 640,
          height: 30,
          samples: 88,
        });
        burnWavePrimaryRef.current.setAttribute('d', primary);
        burnWaveHarmonicRef.current.setAttribute('d', harmonic);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      autoTweenRef.current?.kill();
      observer.disconnect();
    };
  }, []);

  // Cancel any auto-ignition tween immediately when user grabs a dial
  const cancelAutoTween = () => {
    if (autoTweenRef.current) {
      autoTweenRef.current.kill();
      autoTweenRef.current = null;
    }
  };

  // Rotational + vertical fallback pointer interaction on each SVG dial
  const handleDialPointerDown = (
    dialIdx: number,
    e: React.PointerEvent<SVGSVGElement>
  ) => {
    cancelAutoTween();
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx);

    dialStatesRef.current[dialIdx].vel = 0;
    dragInfoRef.current = {
      dialIdx,
      pointerId: e.pointerId,
      cx,
      cy,
      lastAngle: angle,
      lastClientY: e.clientY,
    };
    svg.setPointerCapture(e.pointerId);
  };

  const handleDialPointerMove = (
    dialIdx: number,
    e: React.PointerEvent<SVGSVGElement>
  ) => {
    const drag = dragInfoRef.current;
    if (!drag || drag.dialIdx !== dialIdx || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.cx;
    const dy = e.clientY - drag.cy;
    const radius = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    let deltaNorm = 0;
    if (radius > 24) {
      // Direct circular rotational drag around dial center
      const dAngle = shortestAngleDelta(drag.lastAngle, angle);
      deltaNorm = dAngle / (Math.PI * 1.85);
    } else {
      // Smooth vertical drag fallback near dial center / narrow touch gestures
      deltaNorm = (drag.lastClientY - e.clientY) / 160;
    }

    drag.lastAngle = angle;
    drag.lastClientY = e.clientY;

    const st = dialStatesRef.current[dialIdx];
    st.norm = clamp(st.norm + deltaNorm, 0, 1);
    st.vel = clamp(deltaNorm * 0.92, -0.09, 0.09);
  };

  const handleDialPointerUp = (
    dialIdx: number,
    e: React.PointerEvent<SVGSVGElement>
  ) => {
    const drag = dragInfoRef.current;
    if (drag && drag.dialIdx === dialIdx) {
      dragInfoRef.current = null;
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleDialWheel = (
    dialIdx: number,
    e: React.WheelEvent<SVGSVGElement>
  ) => {
    // Allow subtle precision scroll-wheel tweaking only when Shift is held or explicitly focused
    if (document.activeElement !== e.currentTarget) return;
    e.preventDefault();
    cancelAutoTween();
    const st = dialStatesRef.current[dialIdx];
    const delta = -Math.sign(e.deltaY) * 0.025;
    st.vel = clamp(st.vel + delta, -0.07, 0.07);
  };

  const handleDialKeyDown = (
    dialIdx: number,
    e: React.KeyboardEvent<SVGSVGElement>
  ) => {
    const step = e.shiftKey ? 0.1 : 0.0333; // ~2 magnetic 6° detents per arrow press
    const st = dialStatesRef.current[dialIdx];
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      cancelAutoTween();
      st.norm = clamp(st.norm + step, 0, 1);
      st.vel = 0;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      cancelAutoTween();
      st.norm = clamp(st.norm - step, 0, 1);
      st.vel = 0;
    } else if (e.key === 'Home') {
      e.preventDefault();
      cancelAutoTween();
      st.norm = 0;
      st.vel = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      cancelAutoTween();
      st.norm = 1;
      st.vel = 0;
    }
  };

  // [ AUTO-IGNITE ↗ ] / [ QUENCH ↓ ] smooth GSAP expo.inOut dial choreography
  const handleToggleAutoIgnite = () => {
    cancelAutoTween();
    const states = dialStatesRef.current;
    const proxy = {
      n: states[0].norm,
      t: states[1].norm,
      tau: states[2].norm,
    };

    const targets = ignitedRef.current
      ? {
          n: valueToNorm(1.05, LAWSON_DIAL_CONFIGS[0]),
          t: valueToNorm(120.0, LAWSON_DIAL_CONFIGS[1]),
          tau: valueToNorm(2.5, LAWSON_DIAL_CONFIGS[2]),
        }
      : {
          n: valueToNorm(2.35, LAWSON_DIAL_CONFIGS[0]),
          t: valueToNorm(196.0, LAWSON_DIAL_CONFIGS[1]),
          tau: valueToNorm(4.35, LAWSON_DIAL_CONFIGS[2]),
        };

    autoTweenRef.current = gsap.to(proxy, {
      ...targets,
      duration: ignitedRef.current ? 0.85 : 1.1,
      ease: 'expo.inOut',
      onUpdate: () => {
        states[0].norm = proxy.n;
        states[1].norm = proxy.t;
        states[2].norm = proxy.tau;
        states[0].vel = 0;
        states[1].vel = 0;
        states[2].vel = 0;
      },
      onComplete: () => {
        autoTweenRef.current = null;
      },
    });
  };

  const bgClass = isIgnited ? 'bg-[#111114] text-[#F6F3EB]' : 'bg-[#F6F3EB] text-[#111114]';
  const borderClass = isIgnited ? 'border-[#F6F3EB]' : 'border-[#111114]';
  const inkHex = isIgnited ? '#F6F3EB' : '#111114';
  const paperHex = isIgnited ? '#111114' : '#F6F3EB';

  return (
    <section
      ref={sectionRef}
      id="act-4"
      data-act="4"
      data-act-ink={isIgnited ? 'light' : 'dark'}
      data-ignited={isIgnited ? 'true' : 'false'}
      className={`relative min-h-[100svh] w-full flex flex-col justify-between px-4 sm:px-6 md:px-10 pt-[3.25rem] pb-[2.75rem] border-b border-[#111114] chrome-ink-transition box-border ${bgClass}`}
    >
      {/* Fullscreen Fixed 260ms Pure-White X-Ray Overexposure Flash + Shockfront Ring */}
      <div
        ref={xrayFlashRef}
        className="pointer-events-none fixed inset-0 z-[90] bg-[#FFFFFF] opacity-0"
        style={{ visibility: 'hidden' }}
        aria-hidden="true"
        data-testid="xray-flash-overlay"
      />
      <svg
        ref={xraySvgRef}
        className="pointer-events-none fixed inset-0 z-[91] w-full h-full"
        style={{ visibility: 'hidden' }}
        aria-hidden="true"
      >
        <circle
          ref={xrayRingRef}
          cx="50%"
          cy="50%"
          r="24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeOpacity="0"
        />
      </svg>

      {/* Master 1px-Bordered Unified Single-Viewport Dieter Rams Console Frame */}
      <div
        ref={consoleRef}
        data-testid="act4-console-frame"
        className={`relative z-10 w-full flex-1 flex flex-col justify-between border arch-surface chrome-ink-transition ${borderClass} ${bgClass}`}
      >
        {/* Top Console Bar: Compact Eyebrow + Live Triple Product + Headline (Left) & [ AUTO-IGNITE ↗ ] Switch (Right) */}
        <div className={`border-b px-4 sm:px-6 md:px-7 py-3 sm:py-4 chrome-ink-transition ${borderClass}`}>
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
            <div className="min-w-0 flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <p className="font-mono-lab text-[9.5px] sm:text-[11px] tracking-[0.07em]">
                  {CONTENT.act4.eyebrow}
                </p>
                <span
                  ref={tripleProductRef}
                  data-testid="triple-product-readout"
                  className="font-mono-lab text-[9.5px] sm:text-[11px] font-semibold tracking-[0.05em]"
                  style={{ color: isIgnited ? '#FFB800' : '#111114' }}
                >
                  P = 5.79 × 10²¹ keV·s·m⁻³  //  T = 12.9 keV
                </span>
              </div>

              <h2
                ref={headlineRef}
                data-testid="act4-headline"
                className="ignition-headline k-font-bricolage font-extrabold uppercase"
                style={{ color: isIgnited ? '#F6F3EB' : '#111114' }}
              >
                <KineticText text={CONTENT.act4.headline} font="bricolage" />
              </h2>
            </div>

            <button
              type="button"
              onClick={handleToggleAutoIgnite}
              data-testid="auto-ignite-btn"
              className={`shrink-0 font-mono-lab text-[10.5px] sm:text-xs font-bold tracking-[0.08em] px-3 sm:px-3.5 py-2 border arch-surface cursor-pointer whitespace-nowrap chrome-ink-transition ${
                isIgnited
                  ? 'border-[#FFB800] bg-[#FFB800] text-[#111114]'
                  : 'border-[#111114] bg-transparent text-[#111114] hover:bg-[#111114] hover:text-[#F6F3EB]'
              }`}
            >
              {isIgnited ? CONTENT.act4.quenchLabel : CONTENT.act4.autoIgniteLabel}
            </button>
          </div>
        </div>

        {/* Middle Dial Deck: 3-Column Horizontal Row starting at >= 600px */}
        <div
          className={`flex-1 act4-dial-deck border-b ${borderClass}`}
          data-testid="act4-dial-deck"
        >
          {CONTENT.act4.dials.map((dial, idx) => {
            const cfg = LAWSON_DIAL_CONFIGS[idx];
            const initialNorm = valueToNorm(cfg.defaultVal, cfg);
            const initialVisual = clamp(0.03 + initialNorm * 0.94, 0.03, 0.97);
            const activeArc = generateDialArcPath(150, 150, 108, initialVisual);
            const needleAngle = initialVisual * 360;
            const needleTip = polarToCartesian(150, 150, 104, needleAngle);
            const needleBase = polarToCartesian(150, 150, 68, needleAngle);
            const activeDialAccent =
              isIgnited && idx === 2 ? '#FFB800' : dial.accent;

            return (
              <div
                key={dial.id}
                className={`flex flex-col justify-between border-b min-[600px]:border-b-0 min-[600px]:border-r last:border-b-0 last:border-r-0 ${borderClass}`}
                data-testid={`lawson-dial-${dial.id}`}
              >
                {/* Dial Header Strip */}
                <div
                  className={`flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 border-b font-mono-lab text-[10.5px] sm:text-xs tracking-[0.07em] ${borderClass}`}
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    <span
                      className="inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 arch-surface shrink-0"
                      style={{ backgroundColor: activeDialAccent }}
                    />
                    {dial.symbol}
                  </span>
                  <span>{dial.label}</span>
                </div>

                {/* Interactive Circular Precision SVG Gauge */}
                <div className="flex-1 p-2 sm:p-4 flex items-center justify-center">
                  <svg
                    ref={(el) => {
                      dialSvgRefs.current[idx] = el;
                    }}
                    viewBox="0 0 300 300"
                    style={{ width: 'min(100%, 240px, 34svh)', height: 'auto' }}
                    className="cursor-crosshair active:cursor-grabbing select-none touch-none"
                    role="slider"
                    tabIndex={0}
                    aria-label={`${dial.label} (${dial.symbol}) dial`}
                    aria-valuemin={cfg.min}
                    aria-valuemax={cfg.max}
                    aria-valuenow={cfg.defaultVal}
                    data-testid={`lawson-slider-${dial.id}`}
                    data-interactive="true"
                    onPointerDown={(e) => handleDialPointerDown(idx, e)}
                    onPointerMove={(e) => handleDialPointerMove(idx, e)}
                    onPointerUp={(e) => handleDialPointerUp(idx, e)}
                    onPointerCancel={(e) => handleDialPointerUp(idx, e)}
                    onWheel={(e) => handleDialWheel(idx, e)}
                    onKeyDown={(e) => handleDialKeyDown(idx, e)}
                  >
                    {/* Tightening Geometric Plasma Resonance Crosshair Arcs */}
                    <g
                      ref={(el) => {
                        dialCrosshairRefs.current[idx] = el;
                      }}
                    >
                      <path
                        d="M 150 6 A 144 144 0 0 1 206 17"
                        fill="none"
                        stroke={activeDialAccent}
                        strokeWidth="1.5"
                        strokeOpacity={isIgnited ? 0.85 : 0.45}
                      />
                      <path
                        d="M 294 150 A 144 144 0 0 1 283 206"
                        fill="none"
                        stroke={activeDialAccent}
                        strokeWidth="1.5"
                        strokeOpacity={isIgnited ? 0.85 : 0.45}
                      />
                      <path
                        d="M 150 294 A 144 144 0 0 1 94 283"
                        fill="none"
                        stroke={activeDialAccent}
                        strokeWidth="1.5"
                        strokeOpacity={isIgnited ? 0.85 : 0.45}
                      />
                      <path
                        d="M 6 150 A 144 144 0 0 1 17 94"
                        fill="none"
                        stroke={activeDialAccent}
                        strokeWidth="1.5"
                        strokeOpacity={isIgnited ? 0.85 : 0.45}
                      />
                    </g>

                    {/* Outer Calibration Bezel */}
                    <circle
                      cx="150"
                      cy="150"
                      r="138"
                      fill="none"
                      stroke={inkHex}
                      strokeWidth="1"
                    />

                    {/* 60 Radial Degree Tick Marks (6° Magnetic Detents) */}
                    {ticks.map((t) => (
                      <line
                        key={t.index}
                        x1={t.x1}
                        y1={t.y1}
                        x2={t.x2}
                        y2={t.y2}
                        stroke={inkHex}
                        strokeWidth={t.isMajor ? 1.5 : 0.85}
                        strokeOpacity={t.isMajor ? 0.9 : 0.35}
                      />
                    ))}

                    {/* Passive Track Ring */}
                    <circle
                      cx="150"
                      cy="150"
                      r="108"
                      fill="none"
                      stroke={inkHex}
                      strokeOpacity="0.16"
                      strokeWidth="4"
                    />

                    {/* Colored Active Arc Indicator */}
                    <path
                      ref={(el) => {
                        dialArcRefs.current[idx] = el;
                      }}
                      d={activeArc}
                      fill="none"
                      stroke={activeDialAccent}
                      strokeWidth="5.5"
                      strokeLinecap="butt"
                    />

                    {/* Inner Readout Aperture */}
                    <circle
                      cx="150"
                      cy="150"
                      r="68"
                      fill={paperHex}
                      stroke={inkHex}
                      strokeWidth="1"
                    />

                    {/* Hairline Mechanical Pointer Needle */}
                    <line
                      ref={(el) => {
                        dialNeedleRefs.current[idx] = el;
                      }}
                      x1={needleBase.x}
                      y1={needleBase.y}
                      x2={needleTip.x}
                      y2={needleTip.y}
                      stroke={inkHex}
                      strokeWidth="2.2"
                    />
                    <circle
                      ref={(el) => {
                        dialTipRefs.current[idx] = el;
                      }}
                      cx={needleTip.x}
                      cy={needleTip.y}
                      r="3.5"
                      fill={activeDialAccent}
                    />

                    {/* Large Tabular JetBrains Mono Center Readout */}
                    <text
                      ref={(el) => {
                        dialValueRefs.current[idx] = el;
                      }}
                      x="150"
                      y="146"
                      textAnchor="middle"
                      fill={isIgnited ? activeDialAccent : inkHex}
                      fontSize={idx === 0 ? '16' : '18'}
                      fontWeight="700"
                      className="font-mono-lab"
                    >
                      {formatDialValue(idx, cfg.defaultVal)}
                    </text>
                    <text
                      x="150"
                      y="169"
                      textAnchor="middle"
                      fill={inkHex}
                      fillOpacity="0.72"
                      fontSize="12"
                      letterSpacing="1.2"
                      className="font-mono-lab"
                    >
                      {dial.unit}
                    </text>
                  </svg>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Full-Width Segmented Spectral Bar + Live Phase-Locked Burn Waveform + Q Readout */}
        <div className="px-4 sm:px-6 md:px-7 py-2.5 sm:py-3.5 flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div
              className="flex-1 grid grid-cols-12 sm:grid-cols-24 gap-1"
              aria-hidden="true"
              data-testid="breakeven-bar"
            >
              {Array.from({ length: SEGMENT_COUNT }).map((_, idx) => (
                <span
                  key={`seg-${idx}`}
                  ref={(el) => {
                    segmentRefs.current[idx] = el;
                  }}
                  className={`block h-4 sm:h-5 border arch-surface ${borderClass}`}
                  style={{ backgroundColor: 'transparent' }}
                />
              ))}
            </div>

            <div
              className={`font-mono-lab text-[10.5px] sm:text-xs font-bold tracking-[0.07em] whitespace-nowrap shrink-0 border px-3 py-1.5 arch-surface ${
                isIgnited
                  ? 'border-[#FFB800] text-[#FFB800]'
                  : 'border-[#111114] text-[#111114]'
              }`}
              data-testid="q-gain-readout"
            >
              <span ref={qReadoutRef}>{CONTENT.act4.targetReadout}</span>
            </div>
          </div>

          {/* Live 60fps Phase-Locked Fusion Burn Waveform (Reveals on Q >= 1.00 Burning Equilibrium) */}
          {isIgnited && (
            <div
              className="w-full h-7 sm:h-8 border border-[#F6F3EB]/40 arch-surface px-2 flex items-center"
              data-testid="fusion-burn-waveform"
              aria-label="Live phase-locked self-sustaining fusion burn standing waveform"
            >
              <svg
                viewBox="0 0 640 30"
                preserveAspectRatio="none"
                className="w-full h-full block"
              >
                <line
                  x1="0"
                  y1="15"
                  x2="640"
                  y2="15"
                  stroke="#F6F3EB"
                  strokeOpacity="0.2"
                  strokeWidth="1"
                />
                <path
                  ref={burnWaveHarmonicRef}
                  d="M0,15 L640,15"
                  fill="none"
                  stroke="#00D8FF"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  ref={burnWavePrimaryRef}
                  d="M0,15 L640,15"
                  fill="none"
                  stroke="#FFB800"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
