import React, { useEffect, useRef } from 'react';
import { CONTENT } from '../data/content';
import { motionEngine } from '../engine/motionEngine';

export interface SwissChromeProps {
  inkMode: 'dark' | 'light';
  activeAct: '1' | '2' | '3' | '4' | '5';
  activeStageIndex: number;
  activeWavelength: string;
  activeSwatch: string;
  onReplayShutter: () => void;
}

function pad4(n: number): string {
  const clamped = Math.max(0, Math.min(9999, Math.round(n)));
  return clamped.toString().padStart(4, '0');
}

/**
 * Persistent Neo-Swiss 4-column blueprint gridlines and live 60fps corner telemetry rail.
 * All 60fps velocity, coordinate, and scroll-progress indicator updates write directly to
 * DOM refs inside motionEngine's ticker with ZERO React re-renders.
 */
export const SwissChrome: React.FC<SwissChromeProps> = ({
  inkMode,
  activeAct,
  activeStageIndex,
  activeWavelength,
  activeSwatch,
  onReplayShutter,
}) => {
  const velRef = useRef<HTMLSpanElement | null>(null);
  const coordsRef = useRef<HTMLDivElement | null>(null);
  const progressTickRef = useRef<HTMLSpanElement | null>(null);
  const scaleContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let lastVelText = '';
    let lastCoordsText = '';
    let lastProgressPx = -1;

    const unsubscribe = motionEngine.subscribeFrame((frame) => {
      // 1. Live velocity readout (VEL 00.0)
      if (velRef.current) {
        const absVel = Math.min(99.9, Math.abs(frame.smoothVelocity));
        const velText = absVel.toFixed(1).padStart(4, '0');
        if (velText !== lastVelText) {
          lastVelText = velText;
          velRef.current.textContent = velText;
        }
      }

      // 2. Live 4-digit zero-padded pointer/touch coordinates
      if (coordsRef.current && frame.pointerX >= 0 && frame.pointerY >= 0) {
        const coordsText = `X: ${pad4(frame.pointerX)} / Y: ${pad4(frame.pointerY)}`;
        if (coordsText !== lastCoordsText) {
          lastCoordsText = coordsText;
          coordsRef.current.textContent = coordsText;
        }
      }

      // 3. Sliding hairline progress indicator along the 4-colour spectral scale bar
      if (progressTickRef.current && scaleContainerRef.current) {
        // 4 segments * 12px (h-3) = 48px track height
        const trackHeight = 46;
        const yPx = Math.round(frame.scrollProgress * trackHeight * 2) / 2;
        if (yPx !== lastProgressPx) {
          lastProgressPx = yPx;
          progressTickRef.current.style.transform = `translate3d(0, ${yPx}px, 0)`;
        }
      }
    });

    return unsubscribe;
  }, []);

  const isLightInk = inkMode === 'light';
  const inkColor = isLightInk ? 'text-[#F6F3EB]' : 'text-[#111114]';
  const gridLineColor = isLightInk
    ? 'border-[rgba(246,243,235,0.22)]'
    : 'border-[rgba(17,17,20,0.13)]';
  const scaleBorderColor = isLightInk
    ? 'border-[#F6F3EB]/75'
    : 'border-[#111114]/75';
  const indicatorBg = isLightInk ? 'bg-[#F6F3EB]' : 'bg-[#111114]';
  const actLabel = CONTENT.chrome.actMeta[activeAct].label;

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none select-none"
      data-testid="swiss-chrome"
      data-ink-mode={inkMode}
    >
      {/* Fixed 4-column 1px Swiss blueprint gridlines */}
      <div
        className="absolute inset-0 grid grid-cols-2 md:grid-cols-4 px-4 sm:px-6 md:px-10"
        aria-hidden="true"
      >
        <div className={`h-full border-l border-r chrome-ink-transition ${gridLineColor}`} />
        <div className={`h-full border-r chrome-ink-transition ${gridLineColor}`} />
        <div className={`hidden md:block h-full border-r chrome-ink-transition ${gridLineColor}`} />
        <div className={`hidden md:block h-full border-r chrome-ink-transition ${gridLineColor}`} />
      </div>

      {/* Top Corner Metadata Rail */}
      <div
        className={`absolute top-0 left-0 right-0 flex items-center justify-between gap-2 px-4 sm:px-6 md:px-10 py-3.5 md:py-4 font-mono-lab chrome-ink-transition ${inkColor}`}
      >
        {/* Top-Left: Clickable 656.3nm badge + active spectral swatch (replays Act 0) */}
        <button
          type="button"
          onClick={onReplayShutter}
          aria-label="656.3nm — Replay Shutter Calibration"
          data-testid="replay-shutter-btn"
          className="pointer-events-auto cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap bg-transparent border-0 p-0 text-current arch-surface"
        >
          <span
            className="inline-block w-2 h-2 arch-surface shrink-0 chrome-ink-transition"
            style={{ backgroundColor: activeSwatch }}
            data-testid="chrome-swatch"
          />
          <span className="text-[11px] sm:text-xs font-semibold tracking-[0.06em]">
            {CONTENT.brand}
          </span>
        </button>

        {/* Top-Right: Live Wavelength // Velocity // Active Act */}
        <div
          className="text-[9px] sm:text-[11px] md:text-xs tracking-[0.04em] sm:tracking-[0.06em] whitespace-nowrap truncate text-right"
          data-testid="chrome-telemetry"
        >
          <span>λ {activeWavelength}</span>
          <span aria-hidden="true">{'  //  VEL '}</span>
          <span ref={velRef} data-testid="chrome-velocity">
            00.0
          </span>
          <span aria-hidden="true">{'  //  ACT '}</span>
          <span data-testid="chrome-act">{actLabel}</span>
        </div>
      </div>

      {/* Bottom Corner Metadata Rail */}
      <div
        className={`absolute bottom-0 left-0 right-0 flex items-end justify-between px-4 sm:px-6 md:px-10 py-3.5 md:py-4 font-mono-lab chrome-ink-transition ${inkColor}`}
        aria-hidden="true"
      >
        {/* Bottom-Left: Live 4-digit zero-padded pointer/touch coordinates */}
        <div
          ref={coordsRef}
          className="text-[10px] sm:text-[11px] tracking-[0.08em] whitespace-nowrap"
          data-testid="chrome-coords"
        >
          {CONTENT.chrome.coordsPlaceholder}
        </div>

        {/* Bottom-Right: 4-colour segmented vertical spectral scale bar + live sliding hairline */}
        <div className="relative flex items-start" ref={scaleContainerRef}>
          <span
            ref={progressTickRef}
            className={`absolute -left-2.5 top-0 w-[18px] h-[2px] arch-surface chrome-ink-transition ${indicatorBg}`}
            style={{ transform: 'translate3d(0, 0px, 0)' }}
            data-testid="spectral-progress-tick"
          />
          <div
            className={`flex flex-col border chrome-ink-transition ${scaleBorderColor} arch-surface`}
            data-testid="spectral-scale-bar"
          >
            {CONTENT.chrome.spectralBarColors.map((hex, idx) => (
              <span
                key={hex}
                className="block w-2.5 h-3 arch-surface"
                style={{
                  backgroundColor: hex,
                  opacity: idx === activeStageIndex ? 1 : 0.48,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
