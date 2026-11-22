import React, { useEffect, useRef } from 'react';

export interface OpticalReticleProps {
  /** Active spectral accent hex synced to the current Act */
  accentColor: string;
}

const INTERACTIVE_SELECTOR =
  'button, a, [role="slider"], [role="button"], [data-interactive], canvas';

/**
 * Live Spectral Optical Crosshair Cursor (Fine-Pointer Desktop / Mouse Only).
 * - Automatically disabled on touch / coarse pointers `(hover: none)` / `(pointer: coarse)`
 * - Zero React useState inside pointermove or requestAnimationFrame
 * - 12px central '+' crosshair + 26px crisp corner-bracket target box with 0.22 lerp lag
 * - Snaps tighter (scale: 0.72, rotate: 45deg) when hovering interactive instruments/glyphs
 */
export const OpticalReticle: React.FC<OpticalReticleProps> = ({ accentColor }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const crossRef = useRef<SVGSVGElement | null>(null);
  const bracketRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = rootRef.current;

    if (!isFinePointer || !root) {
      if (root) root.style.display = 'none';
      return;
    }

    root.style.display = 'block';

    let targetX = -100;
    let targetY = -100;
    let crossX = -100;
    let crossY = -100;
    let bracketX = -100;
    let bracketY = -100;
    let visible = false;
    let locked = false;
    let lockProgress = 0;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      targetX = e.clientX;
      targetY = e.clientY;

      if (!visible) {
        visible = true;
        crossX = targetX;
        crossY = targetY;
        bracketX = targetX;
        bracketY = targetY;
        root.style.opacity = '1';
      }

      const el = e.target as Element | null;
      locked = Boolean(el && el.closest(INTERACTIVE_SELECTOR));
    };

    const handlePointerLeave = () => {
      visible = false;
      locked = false;
      root.style.opacity = '0';
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    window.addEventListener('blur', handlePointerLeave, { passive: true });

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (!visible) {
        lastTs = now;
        return;
      }

      const dtMs = Math.min(48, Math.max(4, now - lastTs));
      lastTs = now;
      const dtFactor = dtMs / 16.6667;

      const crossLerp = prefersReduced ? 1 : 1 - Math.pow(1 - 0.62, dtFactor);
      const bracketLerp = prefersReduced ? 1 : 1 - Math.pow(1 - 0.22, dtFactor);
      const lockLerp = prefersReduced ? 1 : 1 - Math.pow(1 - 0.24, dtFactor);

      crossX += (targetX - crossX) * crossLerp;
      crossY += (targetY - crossY) * crossLerp;
      bracketX += (targetX - bracketX) * bracketLerp;
      bracketY += (targetY - bracketY) * bracketLerp;

      const targetLock = locked ? 1 : 0;
      lockProgress += (targetLock - lockProgress) * lockLerp;

      if (crossRef.current) {
        crossRef.current.style.transform = `translate3d(${(crossX - 6).toFixed(2)}px, ${(crossY - 6).toFixed(2)}px, 0)`;
      }

      if (bracketRef.current) {
        const scale = 1 - lockProgress * 0.28; // 1.00 -> 0.72
        const rotateDeg = lockProgress * 45; // 0deg -> 45deg
        bracketRef.current.style.transform = `translate3d(${(bracketX - 13).toFixed(2)}px, ${(bracketY - 13).toFixed(2)}px, 0) scale(${scale.toFixed(3)}) rotate(${rotateDeg.toFixed(2)}deg)`;
      }

      root.setAttribute('data-locked', locked ? 'true' : 'false');
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('blur', handlePointerLeave);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-testid="optical-reticle"
      data-locked="false"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden opacity-0 transition-opacity duration-150"
      style={{ color: accentColor }}
    >
      {/* 12px Central Scientific '+' Crosshair */}
      <svg
        ref={crossRef}
        width="12"
        height="12"
        viewBox="0 0 12 12"
        className="absolute top-0 left-0 will-change-transform"
        style={{ transform: 'translate3d(-100px, -100px, 0)' }}
      >
        <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1" />
      </svg>

      {/* 26px Outer Crisp Corner-Bracket Laser Rangefinder Box */}
      <svg
        ref={bracketRef}
        width="26"
        height="26"
        viewBox="0 0 26 26"
        className="absolute top-0 left-0 will-change-transform origin-center"
        style={{ transform: 'translate3d(-100px, -100px, 0)' }}
      >
        <path d="M1 7 V1 H7" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M19 1 H25 V7" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M25 19 V25 H19" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M7 25 H1 V19" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  );
};
