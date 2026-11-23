import React, { useEffect, useRef } from 'react';
import { CONTENT } from '../data/content';
import { motionEngine } from '../engine/motionEngine';
import { spectralAudio } from '../engine/spectralAudio';
import {
  createWordmarkSprings,
  detonateWordmarkWave,
  exciteWordmarkChar,
  mixPaperToHex,
  stepCoupledWordmarkSprings,
  stepMarqueeOffset,
  type MarqueeState,
} from '../physics/epilogueMath';
import { Act5Ribbon3D } from './three/Act5Ribbon3D';

const WORDMARK_CHARS = Array.from(CONTENT.act5.wordmark);

export interface Act5EpilogueProps {
  onReplayShutter?: () => void;
}

/**
 * ACT 05 — EPILOGUE (Opposing Marquees + 3D Spectral Prism Ribbon + Coupled-Spring 656.3nm)
 * Brutally decluttered Carbon Tungsten (#111114) grand finale:
 * - Opposing colourful velocity-coupled shear marquees (Solar Gold #FFB800 + Balmer Pink/Cyan dividers)
 * - Full-width sculptural 3D Iridescent Spectral Prism Ribbon (Act5Ribbon3D) coupled directly via
 *   uniform float uCharEnergy[7] to the 7 Newton's Cradle wordmark springs
 * - Crisp [ ↺ REPLAY 16,000 FPS SHUTTER ] button
 * Zero colophon archive copy, zero vertical grey divider hairlines, zero duplicate bottom 656.3nm text.
 */
export const Act5Epilogue: React.FC<Act5EpilogueProps> = ({ onReplayShutter }) => {
  const footerRef = useRef<HTMLElement | null>(null);

  // Opposing marquee track & single-segment measurement refs
  const trackARef = useRef<HTMLDivElement | null>(null);
  const segARef = useRef<HTMLSpanElement | null>(null);
  const trackBRef = useRef<HTMLDivElement | null>(null);
  const segBRef = useRef<HTMLDivElement | null>(null);
  const brakeARef = useRef(false);
  const brakeBRef = useRef(false);

  // Coupled-spring 7-char wordmark & 3D ribbon coupling ref
  const charRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const springsRef = useRef(createWordmarkSprings(WORDMARK_CHARS.length));
  const charEnergyRef = useRef<Float32Array>(new Float32Array(7));
  const lastTouchCharRef = useRef<number>(-1);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    let isVisible = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisible = entry.isIntersecting;
        }
      },
      { threshold: 0.01, rootMargin: '160px 0px 160px 0px' }
    );
    observer.observe(footer);

    let widthA = 800;
    let widthB = 800;
    const measureTracks = () => {
      if (segARef.current) {
        widthA = Math.max(200, segARef.current.getBoundingClientRect().width);
      }
      if (segBRef.current) {
        widthB = Math.max(200, segBRef.current.getBoundingClientRect().width);
      }
    };
    measureTracks();
    const ro = new ResizeObserver(measureTracks);
    if (segARef.current) ro.observe(segARef.current);
    if (segBRef.current) ro.observe(segBRef.current);

    const marqueeA: MarqueeState = { offsetPx: 0, currentSpeedPxPerSec: -46 };
    const marqueeB: MarqueeState = { offsetPx: -240, currentSpeedPxPerSec: 40 };

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lastCharKeys = new Array<string>(WORDMARK_CHARS.length).fill('');

    let rafId = 0;
    let lastTs = performance.now();

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

      // 1. Opposing Velocity-Coupled Magnetic Shear Marquees
      if (!prefersReduced) {
        const scrollVel = motionEngine.smoothVelocity;

        const outA = stepMarqueeOffset(marqueeA, {
          baseDirection: -1,
          baseCruiseSpeed: 48,
          scrollVelocity: scrollVel,
          isBraking: brakeARef.current,
          trackWidth: widthA,
          dtSec,
        });
        if (trackARef.current) {
          const st = trackARef.current.style;
          st.transform = `translate3d(${outA.offsetPx}px, 0, 0) skewX(${(outA.slntDeg * 0.8).toFixed(2)}deg)`;
          st.textShadow =
            outA.chromaPx > 0.25
              ? `${outA.chromaPx}px 0 0 rgba(255, 31, 113, 0.72), ${-outA.chromaPx}px 0 0 rgba(0, 216, 255, 0.72)`
              : 'none';
        }

        const outB = stepMarqueeOffset(marqueeB, {
          baseDirection: 1,
          baseCruiseSpeed: 42,
          scrollVelocity: scrollVel,
          isBraking: brakeBRef.current,
          trackWidth: widthB,
          dtSec,
        });
        if (trackBRef.current) {
          const st = trackBRef.current.style;
          st.transform = `translate3d(${outB.offsetPx}px, 0, 0) skewX(${(-outB.slntDeg * 0.8).toFixed(2)}deg)`;
          st.textShadow =
            outB.chromaPx > 0.25
              ? `${outB.chromaPx}px 0 0 rgba(255, 31, 113, 0.78), ${-outB.chromaPx}px 0 0 rgba(0, 216, 255, 0.78)`
              : 'none';
        }
      }

      // 2. Coupled 1D Newton's Cradle Spring-Wave Solver for "656.3nm" -> feeds Act5Ribbon3D!
      const { poses } = stepCoupledWordmarkSprings(springsRef.current, dtFactor);
      const energyArr = charEnergyRef.current;

      for (let i = 0; i < poses.length; i++) {
        const p = poses[i];
        // Feed signed normalized spring wave displacement (-1..+1) directly into GLSL uCharEnergy[7]
        energyArr[i] = Math.max(-1.2, Math.min(1.2, -p.yPx / 18));

        const el = charRefs.current[i];
        if (!el) continue;
        const key = `${p.yPx}|${p.tiltDeg}|${p.wght}|${p.wdth}|${p.colorMix}`;
        if (key === lastCharKeys[i]) continue;
        lastCharKeys[i] = key;

        const st = el.style;
        st.transform =
          p.yPx === 0 && p.tiltDeg === 0
            ? ''
            : `translate3d(0, ${p.yPx}px, 0) rotate(${p.tiltDeg}deg)`;
        st.setProperty('--wght', String(p.wght));
        st.setProperty('--wdth', String(p.wdth));
        st.color = mixPaperToHex(p.spectralHex, p.colorMix);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
      observer.disconnect();
    };
  }, []);

  const handleCharExcite = (idx: number) => {
    exciteWordmarkChar(springsRef.current, idx, -15.5, 0.95);
    spectralAudio.playWordmarkPing(idx, 0.78);
  };

  const handleCharDetonate = (idx: number) => {
    detonateWordmarkWave(springsRef.current, idx);
    spectralAudio.playWordmarkPing(idx, 1.0);
  };

  const handleWordmarkTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const hit = document.elementFromPoint(touch.clientX, touch.clientY);
    const idxAttr = hit?.getAttribute('data-wordmark-idx');
    if (idxAttr !== null && idxAttr !== undefined) {
      const idx = Number(idxAttr);
      if (!Number.isNaN(idx) && idx !== lastTouchCharRef.current) {
        lastTouchCharRef.current = idx;
        handleCharExcite(idx);
      }
    }
  };

  return (
    <footer
      ref={footerRef}
      id="act-5"
      data-act="5"
      data-act-ink="light"
      className="relative min-h-[100svh] w-full bg-[#111114] text-[#F6F3EB] flex flex-col justify-between pt-11 sm:pt-12 overflow-hidden"
    >
      {/* Opposing Colourful Velocity-Coupled Magnetic Shear Marquee Strips */}
      <div className="relative z-10 w-full">
        {/* Band A — Solar Epilogue Gold (#FFB800), gliding LEFT */}
        <div
          className="w-full bg-[#FFB800] text-[#111114] py-3.5 sm:py-4 overflow-hidden select-none"
          data-testid="marquee-band-a"
          onPointerEnter={() => {
            brakeARef.current = true;
          }}
          onPointerLeave={() => {
            brakeARef.current = false;
          }}
          onTouchStart={() => {
            brakeARef.current = true;
          }}
          onTouchEnd={() => {
            brakeARef.current = false;
          }}
        >
          <div
            ref={trackARef}
            data-testid="marquee-track-a"
            className="flex items-center whitespace-nowrap font-mono-lab text-xs sm:text-sm font-bold tracking-[0.08em] will-change-transform"
          >
            <span ref={segARef} className="px-6 shrink-0">
              {CONTENT.act5.bandA}
            </span>
            <span className="px-6 shrink-0" aria-hidden="true">
              {CONTENT.act5.bandA}
            </span>
            <span className="px-6 shrink-0" aria-hidden="true">
              {CONTENT.act5.bandA}
            </span>
            <span className="px-6 shrink-0" aria-hidden="true">
              {CONTENT.act5.bandA}
            </span>
          </div>
        </div>

        {/* Band B — Carbon Tungsten (#111114) with Vivid Balmer Pink & Cyan Dividers, gliding RIGHT */}
        <div
          className="w-full bg-[#111114] text-[#F6F3EB] border-b-2 border-[#FF1F71] py-3.5 sm:py-4 overflow-hidden select-none"
          data-testid="marquee-band-b"
          onPointerEnter={() => {
            brakeBRef.current = true;
          }}
          onPointerLeave={() => {
            brakeBRef.current = false;
          }}
          onTouchStart={() => {
            brakeBRef.current = true;
          }}
          onTouchEnd={() => {
            brakeBRef.current = false;
          }}
        >
          <div
            ref={trackBRef}
            data-testid="marquee-track-b"
            className="flex items-center whitespace-nowrap font-mono-lab text-xs sm:text-sm font-bold tracking-[0.08em] will-change-transform"
          >
            {[0, 1, 2, 3].map((rep) => (
              <div
                key={`b-${rep}`}
                ref={rep === 0 ? segBRef : undefined}
                className="flex items-center shrink-0"
                aria-hidden={rep > 0 ? 'true' : undefined}
              >
                <span className="px-5 shrink-0">{CONTENT.act5.bandB}</span>
                <span
                  className="inline-block w-1 h-4 shrink-0"
                  style={{ backgroundColor: rep % 2 === 0 ? '#FF1F71' : '#00D8FF' }}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monumental 3D Iridescent Spectral Prism Ribbon + Coupled-Spring 656.3nm Wordmark Stage */}
      <div className="relative flex-1 w-full flex flex-col items-center justify-center px-4 sm:px-6 md:px-10 py-10">
        {/* Full-Width 3D Sculptural Spectral Prism Ribbon behind wordmark */}
        <Act5Ribbon3D
          charEnergyRef={charEnergyRef}
          className="absolute inset-0 z-[1] w-full h-full"
        />

        {/* Interactive 7-Char Coupled Newton's Cradle Wordmark */}
        <div
          className="relative z-10 w-full flex items-center justify-center py-6 sm:py-8"
          onTouchMove={handleWordmarkTouchMove}
          onTouchEnd={() => {
            lastTouchCharRef.current = -1;
          }}
        >
          <div
            className="epilogue-wordmark k-font-bricolage font-extrabold text-[#F6F3EB] select-none text-center whitespace-nowrap flex items-baseline justify-center"
            data-testid="epilogue-wordmark"
            aria-label={CONTENT.act5.wordmark}
          >
            {WORDMARK_CHARS.map((ch, idx) => (
              <span
                key={`wm-${idx}-${ch}`}
                ref={(el) => {
                  charRefs.current[idx] = el;
                }}
                role="button"
                tabIndex={0}
                aria-label={`Excite ${ch} spectral spring`}
                data-wordmark-idx={idx}
                data-testid={`wordmark-char-${idx}`}
                data-interactive="true"
                onPointerEnter={() => handleCharExcite(idx)}
                onClick={() => handleCharDetonate(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCharDetonate(idx);
                  }
                }}
                className="k-char inline-flex cursor-pointer px-[0.005em] will-change-transform"
              >
                {ch}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Clean Bottom Replay Action ONLY (ZERO grey archive copy or duplicate 656.3nm text) */}
      <div className="relative z-10 w-full px-4 sm:px-6 md:px-10 pb-8 sm:pb-10 flex items-center justify-center">
        {onReplayShutter && (
          <button
            type="button"
            onClick={onReplayShutter}
            data-testid="epilogue-replay-btn"
            className="pointer-events-auto cursor-pointer border-2 border-[#FFB800] px-4 py-2 font-mono-lab text-[11px] sm:text-xs font-bold tracking-[0.08em] bg-[#111114] text-[#FFB800] hover:bg-[#FFB800] hover:text-[#111114] arch-surface whitespace-nowrap chrome-ink-transition"
          >
            {CONTENT.act5.replayShutterLabel}
          </button>
        )}
      </div>
    </footer>
  );
};
