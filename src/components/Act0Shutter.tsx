import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { CONTENT } from '../data/content';
import { motionEngine } from '../engine/motionEngine';

export interface Act0ShutterProps {
  replayNonce: number;
  onTriggerAct1Reveal: () => void;
}

/**
 * ACT 0 — SHUTTER CALIBRATION (16,000 FPS Preloader)
 * Fullscreen #F6F3EB optical shutter layer (z-index: 100).
 * Rockets 00000 -> 16000 FPS while 4 Balmer laser hairlines whip edge-to-edge,
 * flashes 75ms exposure lock, then slices upward via clip-path overlapping Act 1 reveal.
 */
export const Act0Shutter: React.FC<Act0ShutterProps> = ({
  replayNonce,
  onTriggerAct1Reveal,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const counterRef = useRef<HTMLSpanElement | null>(null);
  const labelRef = useRef<HTMLParagraphElement | null>(null);
  const unitRef = useRef<HTMLSpanElement | null>(null);
  const laserLineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const laserTickRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const onRevealRef = useRef(onTriggerAct1Reveal);

  useEffect(() => {
    onRevealRef.current = onTriggerAct1Reveal;
  }, [onTriggerAct1Reveal]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const urlAutostart =
      replayNonce === 0 &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autostart') === '1';

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (urlAutostart || prefersReducedMotion) {
      gsap.set(root, {
        visibility: 'hidden',
        pointerEvents: 'none',
        clipPath: 'inset(0% 0% 100% 0%)',
      });
      motionEngine.startScroll();
      onRevealRef.current();
      return;
    }

    let cancelled = false;
    let ctx: gsap.Context | null = null;

    // Pause smooth scroll immediately while calibrating shutter
    motionEngine.stopScroll();

    // Ensure initial shutter state is crisp before fonts finish
    gsap.set(root, {
      visibility: 'visible',
      pointerEvents: 'auto',
      clipPath: 'inset(0% 0% 0% 0%)',
      backgroundColor: '#F6F3EB',
    });
    if (counterRef.current) {
      counterRef.current.textContent = '00000';
      counterRef.current.style.color = '#111114';
    }
    if (labelRef.current) labelRef.current.style.color = '#111114';
    if (unitRef.current) unitRef.current.style.color = '#111114';

    const waitForFonts = Promise.race([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
    ]);

    waitForFonts.then(() => {
      if (cancelled || !rootRef.current) return;

      ctx = gsap.context(() => {
        const proxy = { fps: 0 };
        const lines = laserLineRefs.current.filter(
          (el): el is HTMLDivElement => el !== null
        );
        const ticks = laserTickRefs.current.filter(
          (el): el is HTMLSpanElement => el !== null
        );

        gsap.set(lines, { scaleX: 0, transformOrigin: 'left center' });
        gsap.set(ticks, { opacity: 0, x: 8 });

        const tl = gsap.timeline({
          onComplete: () => {
            if (rootRef.current) {
              gsap.set(rootRef.current, {
                visibility: 'hidden',
                pointerEvents: 'none',
              });
            }
          },
        });

        // 0.00s -> 1.00s: High-speed tabular counter 00000 -> 16000 FPS
        tl.to(
          proxy,
          {
            fps: CONTENT.act0.targetFps,
            duration: 1.0,
            ease: 'expo.inOut',
            onUpdate: () => {
              if (counterRef.current) {
                counterRef.current.textContent = Math.round(proxy.fps)
                  .toString()
                  .padStart(5, '0');
              }
            },
          },
          0
        );

        // 0.12s -> 0.90s: 4 razor-thin 2px Balmer laser hairlines whip edge-to-edge
        tl.to(
          lines,
          {
            scaleX: 1,
            duration: 0.62,
            stagger: 0.055,
            ease: 'expo.out',
          },
          0.12
        );

        // Stamp right-edge wavelength ticks (656nm, 486nm, 434nm, 410nm)
        tl.to(
          ticks,
          {
            opacity: 1,
            x: 0,
            duration: 0.24,
            stagger: 0.055,
            ease: 'power4.out',
          },
          0.26
        );

        // 1.00s: Crisp 75ms high-contrast exposure-lock flash (#111114 canvas + #FF1F71 numerals)
        tl.set(
          rootRef.current,
          { backgroundColor: '#111114' },
          1.0
        );
        tl.set(
          counterRef.current,
          { color: '#FF1F71' },
          1.0
        );
        tl.set(
          [labelRef.current, unitRef.current],
          { color: '#F6F3EB' },
          1.0
        );

        // Revert exposure flash after exact 75ms
        tl.set(
          rootRef.current,
          { backgroundColor: '#F6F3EB' },
          1.075
        );
        tl.set(
          [counterRef.current, labelRef.current, unitRef.current],
          { color: '#111114' },
          1.075
        );

        // 1.08s: Resume Lenis the instant shutter wipe begins
        tl.call(
          () => {
            motionEngine.startScroll();
          },
          undefined,
          1.08
        );

        // 1.08s -> 1.70s: Upward optical shutter wipe via GPU clip-path
        tl.to(
          rootRef.current,
          {
            clipPath: 'inset(0% 0% 100% 0%)',
            duration: 0.62,
            ease: 'expo.inOut',
          },
          1.08
        );

        // Overlap by 0.28s+ with Act 1 entrance so there is ZERO pause between Acts 0 and 1
        tl.call(
          () => {
            onRevealRef.current();
          },
          undefined,
          1.34
        );
      }, rootRef);
    });

    return () => {
      cancelled = true;
      ctx?.revert();
      motionEngine.startScroll();
    };
  }, [replayNonce]);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] bg-[#F6F3EB] text-[#111114] flex flex-col items-center justify-center overflow-hidden select-none"
      data-testid="act0-shutter"
      aria-label="Shutter Calibration Preloader"
    >
      {/* Subtle 4-column Swiss grid alignment lines inside shutter */}
      <div
        className="pointer-events-none absolute inset-0 grid grid-cols-2 md:grid-cols-4 px-4 sm:px-6 md:px-10"
        aria-hidden="true"
      >
        <div className="h-full border-l border-r border-[rgba(17,17,20,0.1)]" />
        <div className="h-full border-r border-[rgba(17,17,20,0.1)]" />
        <div className="hidden md:block h-full border-r border-[rgba(17,17,20,0.1)]" />
        <div className="hidden md:block h-full border-r border-[rgba(17,17,20,0.1)]" />
      </div>

      {/* Four razor-thin 2px Balmer laser hairlines + right-edge wavelength ticks */}
      {CONTENT.act0.lasers.map((laser, idx) => (
        <div
          key={laser.wavelength}
          className="pointer-events-none absolute left-0 right-0 flex items-center"
          style={{ top: `${laser.topPct}%` }}
          aria-hidden="true"
        >
          <div
            ref={(el) => {
              laserLineRefs.current[idx] = el;
            }}
            className="w-full h-[2px] arch-surface"
            style={{ backgroundColor: laser.color }}
          />
          <span
            ref={(el) => {
              laserTickRefs.current[idx] = el;
            }}
            className="absolute right-4 sm:right-6 md:right-10 -top-5 font-mono-lab text-[10px] sm:text-xs font-semibold tracking-[0.08em]"
            style={{ color: laser.color }}
          >
            {laser.wavelength}
          </span>
        </div>
      ))}

      {/* Centered Oversized Tabular Counter + Calibration Hairline Labels */}
      <div className="relative z-10 flex flex-col items-center gap-3 px-4">
        <p
          ref={labelRef}
          className="font-mono-lab text-[10px] sm:text-xs tracking-[0.14em] border-b border-current pb-2"
        >
          {CONTENT.act0.label}
        </p>

        <div className="flex items-baseline gap-3 sm:gap-5">
          <span
            ref={counterRef}
            className="shutter-counter font-mono-lab font-bold"
            data-testid="shutter-counter"
          >
            00000
          </span>
          <span
            ref={unitRef}
            className="font-mono-lab text-sm sm:text-lg md:text-xl font-semibold tracking-[0.12em]"
          >
            {CONTENT.act0.unit}
          </span>
        </div>
      </div>
    </div>
  );
};
