import React from 'react';
import { CONTENT } from '../data/content';

export interface SwissChromeProps {
  inkMode: 'dark' | 'light';
  activeStageIndex: number;
}

/**
 * Persistent Neo-Swiss 4-column blueprint gridlines and corner telemetry rail.
 * All architectural borders strictly 0px radius and pointer-events-none.
 */
export const SwissChrome: React.FC<SwissChromeProps> = ({
  inkMode,
  activeStageIndex,
}) => {
  const isLightInk = inkMode === 'light';
  const inkColor = isLightInk ? 'text-[#F6F3EB]' : 'text-[#111114]';
  const gridLineColor = isLightInk
    ? 'border-[rgba(246,243,235,0.22)]'
    : 'border-[rgba(17,17,20,0.13)]';
  const scaleBorderColor = isLightInk
    ? 'border-[#F6F3EB]/70'
    : 'border-[#111114]/70';

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none select-none"
      aria-hidden="true"
      data-testid="swiss-chrome"
      data-ink-mode={inkMode}
    >
      {/* Fixed 4-column 1px Swiss blueprint gridlines */}
      <div className="absolute inset-0 grid grid-cols-2 md:grid-cols-4 px-4 sm:px-6 md:px-10">
        <div className={`h-full border-l border-r ${gridLineColor}`} />
        <div className={`h-full border-r ${gridLineColor}`} />
        <div className={`hidden md:block h-full border-r ${gridLineColor}`} />
        <div className={`hidden md:block h-full border-r ${gridLineColor}`} />
      </div>

      {/* Top Corner Metadata Rail */}
      <div
        className={`absolute top-0 left-0 right-0 flex items-center justify-between gap-2 px-4 sm:px-6 md:px-10 py-3.5 md:py-4 font-mono-lab ${inkColor}`}
      >
        {/* Top-Left: 8px pink swatch + 656.3nm brand */}
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          <span className="inline-block w-2 h-2 bg-[#FF1F71] arch-surface shrink-0" />
          <span className="text-[11px] sm:text-xs font-semibold tracking-[0.06em]">
            {CONTENT.brand}
          </span>
        </div>

        {/* Top-Right: Optical wavelength & frame-rate telemetry */}
        <div className="text-[9px] sm:text-[11px] md:text-xs tracking-[0.04em] sm:tracking-[0.06em] whitespace-nowrap truncate text-right">
          {CONTENT.chrome.topTelemetry}
        </div>
      </div>

      {/* Bottom Corner Metadata Rail */}
      <div
        className={`absolute bottom-0 left-0 right-0 flex items-end justify-between px-4 sm:px-6 md:px-10 py-3.5 md:py-4 font-mono-lab ${inkColor}`}
      >
        {/* Bottom-Left: Tabular pointer coordinate readout */}
        <div className="text-[10px] sm:text-[11px] tracking-[0.08em] whitespace-nowrap">
          {CONTENT.chrome.coordsPlaceholder}
        </div>

        {/* Bottom-Right: 4-colour segmented vertical spectral scale bar */}
        <div
          className={`flex flex-col border ${scaleBorderColor} arch-surface`}
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
  );
};
