import React, { useMemo } from 'react';
import { CONTENT, type SpectralStage } from '../data/content';
import { generateSpectrometerLines } from '../physics/geometry';
import { KineticText } from './KineticText';

export interface Act2LithiumProps {
  activeStageIndex: number;
  onSelectStage: (index: number) => void;
}

/**
 * ACT 02 — DROP THE LITHIUM (Spectral Colour-Blocked Chamber)
 * Static Pass 1 poster with clickable 4-stage wavelength switcher to inspect all 4
 * flat spectral surfaces (#FF1F71, #FF2A2A, #00E676, #00D8FF) and ink contrast.
 * Pre-structured with stage wrapper and drop-rail spine for Pass 3 ScrollTrigger pinning.
 */
export const Act2Lithium: React.FC<Act2LithiumProps> = ({
  activeStageIndex,
  onSelectStage,
}) => {
  const stage: SpectralStage = CONTENT.act2.stages[activeStageIndex] ?? CONTENT.act2.stages[0];
  const isLightInk = stage.ink === '#F6F3EB';
  const hairlineClass = isLightInk ? 'border-[#F6F3EB]/45' : 'border-[#111114]/35';
  const strongBorderClass = isLightInk ? 'border-[#F6F3EB]' : 'border-[#111114]';

  const spectrometerLines = useMemo(
    () =>
      generateSpectrometerLines(
        CONTENT.act2.spectrometerBounds.minNm,
        CONTENT.act2.spectrometerBounds.maxNm
      ),
    []
  );

  // Vertical position of the injected lithium pellet inside the clean upper drop-spine zone
  const pelletYPercent = 18 + activeStageIndex * 4.5;

  return (
    <section
      id="act-2"
      data-act="2"
      data-act-ink={isLightInk ? 'light' : 'dark'}
      data-stage-id={stage.id}
      className="relative min-h-[100svh] w-full flex flex-col justify-between px-4 sm:px-6 md:px-10 pt-16 sm:pt-20 pb-20 sm:pb-20 border-b border-[#111114] overflow-hidden"
      style={{
        backgroundColor: stage.bg,
        color: stage.ink,
      }}
    >
      {/* Center Vertical 1px Lithium-Drop Spine + Geometric Diamond Pellet */}
      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 flex justify-center z-0"
        aria-hidden="true"
      >
        <div
          className="h-full w-px"
          style={{
            backgroundColor: stage.ink,
            opacity: 0.35,
          }}
        />
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          className="absolute -translate-y-1/2"
          style={{ top: `${pelletYPercent}%` }}
          data-testid="lithium-pellet"
        >
          <polygon
            points="12,2 22,12 12,22 2,12"
            fill={stage.ink}
            stroke={stage.bg}
            strokeWidth="1.5"
          />
          <polygon
            points="12,7 17,12 12,17 7,12"
            fill={stage.bg}
          />
        </svg>
      </div>

      {/* Top Eyebrow + Clickable 4-Wavelength Stage Switcher */}
      <div className={`relative z-10 w-full border-t ${hairlineClass} pt-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
        <p className="font-mono-lab text-[10px] sm:text-xs tracking-[0.08em]">
          {CONTENT.act2.eyebrow}
        </p>

        <div
          className="grid grid-cols-2 sm:inline-flex items-stretch border arch-surface"
          style={{ borderColor: stage.ink }}
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
                onClick={() => onSelectStage(idx)}
                className={`font-mono-lab text-[11px] sm:text-xs font-medium tracking-[0.05em] px-3 sm:px-4 min-h-[40px] arch-surface whitespace-nowrap shrink-0 cursor-pointer ${mobileBorderClass}`}
                style={{
                  borderColor: stage.ink,
                  backgroundColor: isActive ? stage.ink : 'transparent',
                  color: isActive ? stage.bg : stage.ink,
                }}
              >
                {item.tabLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Center Stage: Telemetry Readout + Monumental Roboto Flex Headline */}
      <div className="relative z-10 my-auto py-10 sm:py-14 flex flex-col gap-6 sm:gap-8">
        {/* Crisp Wavelength / Transition / Energy Strip */}
        <div
          className={`grid grid-cols-2 md:grid-cols-4 border ${strongBorderClass} arch-surface`}
          style={{ backgroundColor: stage.bg }}
        >
          <div className={`px-3 sm:px-4 py-2.5 sm:py-3 border-b md:border-b-0 border-r ${strongBorderClass}`}>
            <span className="font-mono-lab text-xs sm:text-sm md:text-base font-bold tracking-[0.06em] block">
              {stage.code}
            </span>
          </div>
          <div className={`px-3 sm:px-4 py-2.5 sm:py-3 border-b md:border-b-0 md:border-r ${strongBorderClass}`}>
            <span className="font-mono-lab text-xs sm:text-sm md:text-base font-bold tracking-[0.06em] block">
              {stage.wavelength}
            </span>
          </div>
          <div className={`px-3 sm:px-4 py-2.5 sm:py-3 border-r ${strongBorderClass}`}>
            <span className="font-mono-lab text-xs sm:text-sm md:text-base tracking-[0.05em] block">
              {stage.transition}
            </span>
          </div>
          <div className="px-3 sm:px-4 py-2.5 sm:py-3">
            <span className="font-mono-lab text-xs sm:text-sm md:text-base font-semibold tracking-[0.06em] block">
              {stage.energy}
            </span>
          </div>
        </div>

        {/* Giant Roboto Flex Headline (wdth 128, wght 900, slnt -6 + live Doppler shear) */}
        <h2 className="stage-headline k-font-roboto-flex uppercase break-words doppler-heading">
          <KineticText text={stage.title} font="roboto-flex" />
        </h2>
      </div>

      {/* Bottom Emission Spectrometer Barcode (410nm — 671nm) */}
      <div className="relative z-10 w-full">
        <div
          className={`border ${strongBorderClass} arch-surface px-3 sm:px-5 pt-3 pb-3.5`}
          style={{ backgroundColor: stage.bg }}
          data-testid="emission-spectrometer"
        >
          <div className="relative h-14 sm:h-16 w-full">
            {/* Baseline horizontal calibration rail */}
            <div
              className="absolute bottom-0 left-0 right-0 h-px"
              style={{ backgroundColor: stage.ink, opacity: 0.45 }}
            />

            {/* Spectral lines */}
            {spectrometerLines.map((line) => {
              const isSelectedLine = line.stageId === stage.id;
              return (
                <div
                  key={`${line.nm}-${line.isMajor ? 'm' : 's'}`}
                  className="absolute bottom-0 top-0 -translate-x-1/2 flex flex-col items-center justify-end"
                  style={{ left: `${line.positionPct}%` }}
                >
                  {isSelectedLine ? (
                    <span
                      className="block w-2 h-2 mb-1 arch-surface"
                      style={{ backgroundColor: stage.ink }}
                    />
                  ) : null}
                  <span
                    className="block arch-surface"
                    style={{
                      width: isSelectedLine ? '4px' : line.isMajor ? '2px' : '1px',
                      height: isSelectedLine ? '100%' : line.isMajor ? '78%' : '42%',
                      backgroundColor: stage.ink,
                      opacity: isSelectedLine ? 1 : line.isMajor ? 0.58 : 0.24,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* 410nm — 671nm Axis Bounds */}
          <div className="mt-2 flex items-center justify-between font-mono-lab text-[10px] sm:text-xs tracking-[0.08em]">
            <span>{CONTENT.act2.spectrometerBounds.minLabel}</span>
            <span>{stage.wavelength}</span>
            <span>{CONTENT.act2.spectrometerBounds.maxLabel}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
