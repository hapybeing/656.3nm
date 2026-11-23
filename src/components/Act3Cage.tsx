import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONTENT, type CageMode } from '../data/content';
import { spectralAudio } from '../engine/spectralAudio';
import { generateCirclePath } from '../physics/geometry';
import {
  computeHeadlinePinch,
  computeMagneticPressureMPa,
} from '../physics/cage3dMath';
import { clamp, stepSpring, type SpringState } from '../physics/motionMath';
import { KineticText } from './KineticText';
import { Act3Stellarator3D, type Act3VisualState } from './three/Act3Stellarator3D';

gsap.registerPlugin(ScrollTrigger);

/**
 * ACT 03 — THE MAGNETIC CAGE (Solid 3D Vertex-Morphed Tokamak <-> W7-X Stellarator)
 * Brutally decluttered Balmer Cobalt (#1822FF) + Acid Tungsten (#EAFF2B):
 * - Bold #EAFF2B "NO WALL / CAN TOUCH / A STAR." headline coupled live to Tesla pinch
 * - Vibrant TOKAMAK / STELLARATOR topology switch (1.15s expo.inOut 3D vertex morph)
 * - Tactile B-FIELD slider with ONLY vivid #EAFF2B "B-FIELD: 12.0 T // 57.3 MPa" readout
 * - Rotating SVG <textPath> outer ring framing massive sculptural 3D Act3Stellarator3D
 * Zero muted eyebrow text, zero bottom grey telemetry strip, zero redundant grey box borders.
 */
export const Act3Cage: React.FC = () => {
  const [mode, setMode] = useState<CageMode>('tokamak');

  const sectionRef = useRef<HTMLElement | null>(null);
  const viewportWrapRef = useRef<HTMLDivElement | null>(null);
  const headlineRef = useRef<HTMLHeadingElement | null>(null);
  const lineMaskRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const lineInnerRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const ringTextSvgRef = useRef<SVGSVGElement | null>(null);

  // Direct-DOM refs for zero-re-render 60fps Tesla slider & vivid readout
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const sliderFillRef = useRef<HTMLDivElement | null>(null);
  const sliderHandleRef = useRef<HTMLDivElement | null>(null);
  const telemetryBannerRef = useRef<HTMLDivElement | null>(null);
  const bFieldReadoutRef = useRef<HTMLSpanElement | null>(null);
  const pressureReadoutRef = useRef<HTMLSpanElement | null>(null);

  // Mutable 60fps physics & 3D orbit refs (zero useState in rAF / drag)
  const morphProxyRef = useRef({ t: 0 });
  const targetTeslaRef = useRef<number>(CONTENT.act3.defaultTesla);
  const currentTeslaSpringRef = useRef<SpringState>({
    pos: CONTENT.act3.defaultTesla,
    vel: 0,
  });
  const orbitRef = useRef({
    rotY: 0.42,
    rotX: 0.54,
    velY: 0,
    velX: 0,
    dragging: false,
    lastPtrX: 0,
    lastPtrY: 0,
  });
  const visual3DRef = useRef<Act3VisualState>({
    morphT: 0,
    bField: CONTENT.act3.defaultTesla,
    rotY: 0.42,
    rotX: 0.54,
    disruptionFactor: 0,
  });
  const ringAngleDegRef = useRef(0);
  const entranceDoneRef = useRef(false);

  const ringTextPath = useMemo(() => generateCirclePath(300, 300, 274), []);
  const repeatedRingText = `${CONTENT.act3.fieldRingText}${CONTENT.act3.fieldRingText}${CONTENT.act3.fieldRingText}`;

  // Sync mode tab clicks to continuous 1.15s expo.inOut topological morph
  const isFirstModeMountRef = useRef(true);
  useEffect(() => {
    if (isFirstModeMountRef.current) {
      isFirstModeMountRef.current = false;
      return;
    }
    spectralAudio.playTopologyClick(mode);
    const tween = gsap.to(morphProxyRef.current, {
      t: mode === 'stellarator' ? 1 : 0,
      duration: 1.15,
      ease: 'expo.inOut',
      overwrite: true,
    });
    return () => {
      tween.kill();
    };
  }, [mode]);

  // Update target Tesla & vivid #EAFF2B / #FF2A2A slider DOM synchronously (zero React setState)
  const applySliderDom = (tesla: number) => {
    const clamped = Number(clamp(tesla, 0, 20).toFixed(1));
    targetTeslaRef.current = clamped;
    const pct = (clamped / 20) * 100;
    const isDisrupted = clamped < 3.0;
    const pressureMPa = computeMagneticPressureMPa(clamped);

    if (sliderTrackRef.current) {
      sliderTrackRef.current.setAttribute('aria-valuenow', String(clamped));
      sliderTrackRef.current.setAttribute(
        'aria-valuetext',
        `${clamped.toFixed(1)} Tesla, ${pressureMPa.toFixed(1)} MegaPascals`
      );
    }
    if (sliderFillRef.current) {
      sliderFillRef.current.style.width = `${pct.toFixed(2)}%`;
      sliderFillRef.current.style.backgroundColor = isDisrupted ? '#FF2A2A' : '#EAFF2B';
    }
    if (sliderHandleRef.current) {
      sliderHandleRef.current.style.left = `${pct.toFixed(2)}%`;
      sliderHandleRef.current.style.backgroundColor = isDisrupted ? '#FF2A2A' : '#EAFF2B';
      sliderHandleRef.current.style.borderColor = isDisrupted ? '#F6F3EB' : '#1822FF';
    }
    if (bFieldReadoutRef.current) {
      bFieldReadoutRef.current.textContent = `${clamped.toFixed(1)} T`;
    }
    if (pressureReadoutRef.current) {
      pressureReadoutRef.current.textContent = isDisrupted
        ? CONTENT.act3.disruptionWarning
        : `${pressureMPa.toFixed(1)} MPa`;
    }
    if (telemetryBannerRef.current) {
      if (isDisrupted) {
        telemetryBannerRef.current.style.backgroundColor = '#FF2A2A';
        telemetryBannerRef.current.style.color = '#F6F3EB';
      } else {
        telemetryBannerRef.current.style.backgroundColor = 'transparent';
        telemetryBannerRef.current.style.color = '#EAFF2B';
      }
    }
  };

  // Choreographed Act 3 ScrollTrigger entrance (once: true, top 75%)
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    applySliderDom(CONTENT.act3.defaultTesla);

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReducedMotion) {
      entranceDoneRef.current = true;
      return;
    }

    const ctx = gsap.context(() => {
      const masks = lineMaskRefs.current.filter(
        (el): el is HTMLSpanElement => el !== null
      );
      const inners = lineInnerRefs.current.filter(
        (el): el is HTMLSpanElement => el !== null
      );

      gsap.set(masks, { overflow: 'hidden' });
      gsap.set(inners, { yPercent: 115 });
      if (viewportWrapRef.current) {
        gsap.set(viewportWrapRef.current, { scale: 0.88, opacity: 0 });
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 75%',
          once: true,
        },
        onComplete: () => {
          gsap.set(masks, { overflow: 'visible' });
          entranceDoneRef.current = true;
        },
      });

      tl.to(
        inners,
        {
          yPercent: 0,
          duration: 0.86,
          stagger: 0.08,
          ease: 'expo.out',
        },
        0
      );

      if (headlineRef.current) {
        tl.fromTo(
          headlineRef.current,
          { '--cage-wght': 240, '--cage-wdth': 75 } as gsap.TweenVars,
          {
            '--cage-wght': 620,
            '--cage-wdth': 85,
            duration: 0.9,
            ease: 'expo.out',
          } as gsap.TweenVars,
          0
        );
      }

      if (viewportWrapRef.current) {
        tl.to(
          viewportWrapRef.current,
          {
            scale: 1,
            opacity: 1,
            duration: 0.95,
            ease: 'expo.out',
          },
          0.08
        );
      }

      tl.fromTo(
        morphProxyRef.current,
        { t: 0.35 },
        { t: 0, duration: 1.1, ease: 'expo.out' },
        0.12
      );
    }, sectionRef);

    return () => {
      ctx.revert();
    };
  }, []);

  // 60fps Physics Synchronization Loop (drives headline pinch, rotating ring, orbit inertia, & Act3Stellarator3D ref)
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

    let rafId = 0;
    let lastTs = performance.now();
    let lastPinchKey = '';

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (!isVisible) {
        lastTs = now;
        return;
      }

      const dtMs = Math.min(48, Math.max(4, now - lastTs));
      lastTs = now;
      const dtSec = dtMs * 0.001;
      const dtFactor = dtMs / 16.6667;
      const timeSec = now * 0.001;

      const teslaSpring = currentTeslaSpringRef.current;
      stepSpring(teslaSpring, targetTeslaRef.current, 0.16, 0.74, dtFactor);
      if (
        Math.abs(teslaSpring.pos - targetTeslaRef.current) < 0.015 &&
        Math.abs(teslaSpring.vel) < 0.015
      ) {
        teslaSpring.pos = targetTeslaRef.current;
        teslaSpring.vel = 0;
      }
      const bField = clamp(teslaSpring.pos, 0, 20);
      const morphT = clamp(morphProxyRef.current.t, 0, 1);

      const pinch = computeHeadlinePinch(bField);

      if (headlineRef.current && entranceDoneRef.current) {
        const hs = headlineRef.current.style;
        const pinchKey = `${pinch.wdth.toFixed(1)}|${pinch.wght.toFixed(0)}|${pinch.letterSpacingEm.toFixed(4)}`;
        if (pinchKey !== lastPinchKey) {
          lastPinchKey = pinchKey;
          hs.setProperty('--cage-wdth', String(pinch.wdth));
          hs.setProperty('--cage-wght', String(pinch.wght));
          hs.setProperty('--cage-tracking', `${pinch.letterSpacingEm}em`);
        }

        if (pinch.isDisrupted) {
          const jitterX =
            (Math.sin(timeSec * 53) * 0.6 + Math.cos(timeSec * 89) * 0.4) *
            6.5 *
            pinch.disruptionFactor;
          const jitterSkew =
            Math.sin(timeSec * 41) * 4.5 * pinch.disruptionFactor;
          hs.transform = `translate3d(${jitterX.toFixed(1)}px, 0, 0) skewX(${jitterSkew.toFixed(2)}deg)`;
        } else if (hs.transform !== '') {
          hs.transform = '';
        }
      }

      // GPU-composited rotation of outer SVG <textPath> ring
      ringAngleDegRef.current =
        (ringAngleDegRef.current +
          ((pinch.ringAngularSpeedRad * 180) / Math.PI) * dtSec) %
        360;
      if (ringTextSvgRef.current) {
        ringTextSvgRef.current.style.transform = `rotate(${ringAngleDegRef.current.toFixed(2)}deg)`;
      }

      // 3D orbit inertia + smooth gyroscopic auto-orbit
      const orb = orbitRef.current;
      if (!orb.dragging) {
        orb.velY *= Math.pow(0.92, dtFactor);
        orb.velX *= Math.pow(0.92, dtFactor);
        orb.rotY += orb.velY + (0.24 + (bField / 20) * 0.16) * dtSec;
        orb.rotX = clamp(orb.rotX + orb.velX, -1.25, 1.25);
      }

      // Sync mutable visual state directly to Act3Stellarator3D (zero React re-renders)
      const v = visual3DRef.current;
      v.morphT = morphT;
      v.bField = bField;
      v.rotY = orb.rotY;
      v.rotX = orb.rotX;
      v.disruptionFactor = pinch.disruptionFactor;
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  // Interactive 3D Orbit Pointer/Touch Handlers on the 3D Stage
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const orb = orbitRef.current;
    orb.dragging = true;
    orb.lastPtrX = e.clientX;
    orb.lastPtrY = e.clientY;
    orb.velX = 0;
    orb.velY = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const orb = orbitRef.current;
    if (!orb.dragging) return;
    const dx = e.clientX - orb.lastPtrX;
    const dy = e.clientY - orb.lastPtrY;
    orb.lastPtrX = e.clientX;
    orb.lastPtrY = e.clientY;

    const dRotY = dx * 0.0085;
    const dRotX = dy * 0.0075;
    orb.rotY += dRotY;
    orb.rotX = clamp(orb.rotX + dRotX, -1.25, 1.25);
    orb.velY = dRotY;
    orb.velX = dRotX;
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    orbitRef.current.dragging = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Tactile Tesla Instrument Slider Drag & Keyboard Control (zero useState)
  const updateTeslaFromClientX = (clientX: number) => {
    const track = sliderTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const tesla = Math.round(ratio * 200) / 10;
    applySliderDom(tesla);
    spectralAudio.playMagneticStep(tesla, tesla < 3.0);
  };

  const handleSliderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateTeslaFromClientX(e.clientX);
  };

  const handleSliderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updateTeslaFromClientX(e.clientX);
  };

  const handleSliderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 2.0 : 0.5;
    const cur = targetTeslaRef.current;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      applySliderDom(cur + step);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      applySliderDom(cur - step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      applySliderDom(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      applySliderDom(20);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="act-3"
      data-act="3"
      data-act-ink="light"
      data-cage-mode={mode}
      className="relative min-h-[100svh] w-full bg-[#1822FF] text-[#F6F3EB] flex flex-col justify-center px-4 sm:px-6 md:px-10 pr-7 sm:pr-10 md:pr-14 py-16 sm:py-14 overflow-hidden box-border"
    >
      {/* Simultaneous 2-Column Swiss Split (>= 680px: 0.94fr Controls + 1.06fr Sculptural 3D Manifold) */}
      <div
        className="relative z-10 w-full act3-split-grid my-auto"
        data-testid="act3-split-grid"
      >
        {/* Column 1: Acid Tungsten Headline + Topology Switch + Vivid Tesla Pinch Slider */}
        <div className="flex flex-col justify-center gap-6 sm:gap-7 min-w-0">
          <h2
            ref={headlineRef}
            className="cage-headline k-font-bricolage uppercase text-[#EAFF2B] doppler-heading doppler-shear"
            data-testid="act3-headline"
          >
            {CONTENT.act3.headlineLines.map((line, idx) => (
              <span
                key={line}
                ref={(el) => {
                  lineMaskRefs.current[idx] = el;
                }}
                className="block overflow-hidden"
              >
                <span
                  ref={(el) => {
                    lineInnerRefs.current[idx] = el;
                  }}
                  className="block"
                >
                  <KineticText
                    text={line}
                    font="bricolage"
                    charStartIndex={idx * 16}
                  />
                </span>
              </span>
            ))}
          </h2>

          {/* Vibrant TOKAMAK / STELLARATOR Topology Switch */}
          <div
            className="grid grid-cols-1 xl:grid-cols-2 w-full border-2 border-[#EAFF2B] arch-surface"
            role="group"
            aria-label="Magnetic confinement topology mode"
          >
            {CONTENT.act3.modes.map((item) => {
              const isActive = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setMode(item.id)}
                  className={`font-mono-lab text-[10.5px] sm:text-xs font-bold tracking-[0.05em] px-3 py-2.5 min-h-[38px] arch-surface whitespace-nowrap truncate cursor-pointer border-b-2 xl:border-b-0 xl:border-r-2 last:border-b-0 last:border-r-0 border-[#EAFF2B] ${
                    isActive
                      ? 'bg-[#EAFF2B] text-[#1822FF]'
                      : 'bg-transparent text-[#F6F3EB] hover:bg-[#EAFF2B]/15'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Tactile B-FIELD Slider + ONLY Vivid #EAFF2B Readout */}
          <div className="w-full flex flex-col gap-2.5">
            <div
              ref={telemetryBannerRef}
              className="w-full px-1 py-1 arch-surface font-mono-lab text-xs sm:text-sm font-bold tracking-[0.06em] text-[#EAFF2B] flex flex-wrap items-center gap-2"
              data-testid="tesla-telemetry-banner"
            >
              <span>
                B-FIELD: <span ref={bFieldReadoutRef}>12.0 T</span>
              </span>
              <span aria-hidden="true">//</span>
              <span
                ref={pressureReadoutRef}
                data-testid="tesla-pressure-readout"
              >
                57.3 MPa
              </span>
            </div>

            <div
              ref={sliderTrackRef}
              role="slider"
              tabIndex={0}
              aria-label="Magnetic Field Strength in Tesla"
              aria-valuemin={0}
              aria-valuemax={20}
              aria-valuenow={CONTENT.act3.defaultTesla}
              data-testid="tesla-slider"
              data-interactive="true"
              onPointerDown={handleSliderPointerDown}
              onPointerMove={handleSliderPointerMove}
              onPointerUp={handleSliderPointerUp}
              onPointerCancel={handleSliderPointerUp}
              onKeyDown={handleSliderKeyDown}
              className="relative w-full h-10 sm:h-11 border-2 border-[#EAFF2B] arch-surface cursor-ew-resize select-none touch-none flex items-center"
            >
              <div
                ref={sliderFillRef}
                className="pointer-events-none absolute inset-y-0 left-0 bg-[#EAFF2B] arch-surface"
                style={{ width: '60%', opacity: 0.3 }}
              />

              <div
                className="pointer-events-none absolute inset-0 flex justify-between px-0"
                aria-hidden="true"
              >
                {Array.from({ length: 21 }).map((_, idx) => (
                  <span
                    key={`t-${idx}`}
                    className="block w-px self-end"
                    style={{
                      height: idx % 5 === 0 ? '48%' : '26%',
                      backgroundColor:
                        idx < 3
                          ? '#FF2A2A'
                          : idx % 5 === 0
                            ? '#EAFF2B'
                            : 'rgba(234, 255, 43, 0.35)',
                    }}
                  />
                ))}
              </div>

              <div
                ref={sliderHandleRef}
                className="pointer-events-none absolute top-0 bottom-0 w-4 -translate-x-1/2 bg-[#EAFF2B] border-2 border-[#1822FF] arch-surface"
                style={{ left: '60%' }}
              />
            </div>
          </div>
        </div>

        {/* Column 2: Sculptural 3D Tokamak <-> Stellarator Framed by Rotating SVG <textPath> Ring */}
        <div
          ref={viewportWrapRef}
          className="flex items-center justify-center min-w-0"
        >
          <div
            className="relative aspect-square flex items-center justify-center"
            style={{ width: 'min(100%, 620px, 76svh)' }}
          >
            {/* GPU-Composited Rotating SVG <textPath> Outer Telemetry Ring */}
            <svg
              ref={ringTextSvgRef}
              viewBox="0 0 600 600"
              className="pointer-events-none absolute inset-0 w-full h-full z-20"
              style={{ transformOrigin: '50% 50%' }}
              aria-hidden="true"
            >
              <defs>
                <path id="cage-field-ring-path" d={ringTextPath} />
              </defs>
              <text
                fill="#EAFF2B"
                fontSize="10.2"
                fontWeight="700"
                letterSpacing="2.9"
                className="font-mono-lab"
              >
                <textPath href="#cage-field-ring-path" startOffset="0%">
                  {repeatedRingText}
                </textPath>
              </text>
            </svg>

            {/* Massive Interactive Solid 3D Tokamak <-> Stellarator WebGL Engine */}
            <Act3Stellarator3D
              stateRef={visual3DRef}
              ariaLabel={
                mode === 'tokamak'
                  ? 'Interactive 3D Tokamak symmetric toroidal magnetic confinement manifold'
                  : 'Interactive 3D Wendelstein 7-X 5-fold twisted Stellarator helical manifold with edge magnetic islands'
              }
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerUp}
              className="relative z-10 w-[90%] h-[90%] cursor-grab active:cursor-grabbing touch-none"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
