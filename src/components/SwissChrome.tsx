import React, { useEffect, useRef, useState } from 'react';
import { CONTENT } from '../data/content';
import { motionEngine } from '../engine/motionEngine';
import { spectralAudio } from '../engine/spectralAudio';

export interface SwissChromeProps {
  inkMode: 'dark' | 'light';
  activeStageIndex: number;
  activeSwatch: string;
  onReplayShutter: () => void;
}

/**
 * Ultra-minimal persistent spectral chrome:
 * - Top-left: clickable 656.3nm swatch badge (replays Act 0) + [ AUDIO: OFF/ON ] toggle
 * - Right edge: razor-clean 3px vertical 4-colour spectral scroll progress bar (zero text)
 * Zero faint grey gridlines, zero coordinate spam, zero top-right metadata clutter.
 */
export const SwissChrome: React.FC<SwissChromeProps> = ({
  inkMode,
  activeStageIndex,
  activeSwatch,
  onReplayShutter,
}) => {
  const [audioOn, setAudioOn] = useState(false);
  const progressTickRef = useRef<HTMLSpanElement | null>(null);
  const scaleContainerRef = useRef<HTMLDivElement | null>(null);
  const meterBarRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    return spectralAudio.subscribe((enabled, level) => {
      setAudioOn(enabled);
      const heights = enabled
        ? [
            Math.max(25, Math.round(level * 70 + 20)),
            Math.max(35, Math.round(level * 100)),
            Math.max(20, Math.round(level * 62 + 15)),
          ]
        : [20, 20, 20];
      for (let i = 0; i < 3; i++) {
        const bar = meterBarRefs.current[i];
        if (bar) {
          bar.style.height = `${heights[i]}%`;
          bar.style.opacity = enabled ? '1' : '0.35';
        }
      }
    });
  }, []);

  useEffect(() => {
    let lastProgressPx = -1;

    const unsubscribe = motionEngine.subscribeFrame((frame) => {
      if (progressTickRef.current && scaleContainerRef.current) {
        const trackH = scaleContainerRef.current.clientHeight || 160;
        const yPx = Math.round(frame.scrollProgress * Math.max(1, trackH - 3) * 2) / 2;
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
  const indicatorBg = isLightInk ? 'bg-[#F6F3EB]' : 'bg-[#111114]';

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none select-none"
      data-testid="swiss-chrome"
      data-ink-mode={inkMode}
    >
      {/* Top-Left ONLY: Clickable 656.3nm spectral badge + [ AUDIO: OFF/ON ] toggle */}
      <div
        className={`absolute top-0 left-0 flex items-center gap-2.5 sm:gap-3 px-4 sm:px-6 md:px-10 py-3.5 md:py-4 font-mono-lab chrome-ink-transition ${inkColor}`}
      >
        <button
          type="button"
          onClick={onReplayShutter}
          aria-label="656.3nm — Replay Shutter Calibration"
          data-testid="replay-shutter-btn"
          className="pointer-events-auto cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap bg-transparent border-0 p-0 text-current arch-surface"
        >
          <span
            className="inline-block w-2.5 h-2.5 arch-surface shrink-0 chrome-ink-transition"
            style={{ backgroundColor: activeSwatch }}
            data-testid="chrome-swatch"
          />
          <span className="text-[11px] sm:text-xs font-bold tracking-[0.06em]">
            {CONTENT.brand}
          </span>
        </button>

        <button
          type="button"
          onClick={() => spectralAudio.toggle()}
          aria-pressed={audioOn}
          aria-label={
            audioOn
              ? 'Mute spectral audio synthesizer'
              : 'Enable spectral audio synthesizer'
          }
          data-testid="audio-toggle-btn"
          className="pointer-events-auto cursor-pointer inline-flex items-center gap-1.5 border border-current px-2 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-[0.08em] bg-transparent text-current arch-surface whitespace-nowrap chrome-ink-transition"
        >
          <span>{audioOn ? 'AUDIO: ON' : 'AUDIO: OFF'}</span>
          <span
            className="inline-flex items-end gap-[2px] h-2.5 w-2.5"
            aria-hidden="true"
          >
            {[0, 1, 2].map((b) => (
              <span
                key={`m-${b}`}
                ref={(el) => {
                  meterBarRefs.current[b] = el;
                }}
                className="block w-[2px] bg-current arch-surface"
                style={{ height: '20%', opacity: 0.35 }}
              />
            ))}
          </span>
        </button>
      </div>

      {/* Right Edge ONLY: Razor-clean 3px vertical 4-colour spectral scroll progress bar (zero text) */}
      <div
        className="absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 flex items-start"
        ref={scaleContainerRef}
        aria-hidden="true"
      >
        <span
          ref={progressTickRef}
          className={`absolute -left-[6px] top-0 w-[15px] h-[3px] arch-surface chrome-ink-transition ${indicatorBg}`}
          style={{ transform: 'translate3d(0, 0px, 0)' }}
          data-testid="spectral-progress-tick"
        />
        <div
          className="flex flex-col w-[3px] h-[168px] sm:h-[208px] arch-surface overflow-hidden"
          data-testid="spectral-scale-bar"
        >
          {CONTENT.chrome.spectralBarColors.map((hex, idx) => (
            <span
              key={hex}
              className="block flex-1 w-full arch-surface"
              style={{
                backgroundColor: hex,
                opacity: idx === activeStageIndex ? 1 : 0.72,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
