import React, { useMemo } from 'react';
import { CONTENT } from '../data/content';
import {
  generateDialArcPath,
  generateDialTicks,
  polarToCartesian,
} from '../physics/geometry';
import { KineticText } from './KineticText';

/**
 * ACT 04 — THE IGNITION INSTRUMENT (Lawson Criterion)
 * Full-bleed Ceramic Paper (#F6F3EB) Dieter Rams lab console partitioned strictly
 * by 1px solid #111114 architectural borders.
 */
export const Act4Ignition: React.FC = () => {
  const ticks = useMemo(() => generateDialTicks(150, 150, 132, 60), []);
  const segmentCount = 24;
  // Mean triple-product fill across the 3 static calibration dials (~70%)
  const filledSegments = 17;

  return (
    <section
      id="act-4"
      data-act="4"
      data-act-ink="dark"
      className="relative min-h-[100svh] w-full bg-[#F6F3EB] text-[#111114] flex flex-col justify-center px-4 sm:px-6 md:px-10 pt-16 sm:pt-20 pb-14 sm:pb-16 border-b border-[#111114]"
    >
      {/* Master 1px-Bordered Dieter Rams Console Frame */}
      <div className="w-full border border-[#111114] arch-surface bg-[#F6F3EB]">
        {/* Top Console Cell: Eyebrow + Headline */}
        <div className="border-b border-[#111114] px-4 sm:px-6 md:px-8 py-5 sm:py-7">
          <p className="font-mono-lab text-[10px] sm:text-xs tracking-[0.08em] text-[#111114] mb-3">
            {CONTENT.act4.eyebrow}
          </p>
          <h2 className="ignition-headline k-font-bricolage font-extrabold uppercase text-[#111114]">
            <KineticText text={CONTENT.act4.headline} font="bricolage" />
          </h2>
        </div>

        {/* Middle Row: 3 Oversized Precision SVG Instrument Dials */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-b border-[#111114]">
          {CONTENT.act4.dials.map((dial) => {
            const activeArc = generateDialArcPath(150, 150, 108, dial.progress);
            const needleAngle = dial.progress * 360;
            const needleTip = polarToCartesian(150, 150, 104, needleAngle);
            const needleBase = polarToCartesian(150, 150, 68, needleAngle);

            return (
              <div
                key={dial.id}
                className="flex flex-col justify-between border-b md:border-b-0 md:border-r last:border-b-0 last:border-r-0 border-[#111114]"
                data-testid={`lawson-dial-${dial.id}`}
              >
                {/* Dial Header Strip */}
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#111114] font-mono-lab text-xs tracking-[0.08em]">
                  <span className="flex items-center gap-2 font-bold">
                    <span
                      className="inline-block w-2.5 h-2.5 arch-surface shrink-0"
                      style={{ backgroundColor: dial.accent }}
                    />
                    {dial.symbol}
                  </span>
                  <span>{dial.label}</span>
                </div>

                {/* Circular Precision SVG Gauge */}
                <div className="p-5 sm:p-6 md:p-7 flex items-center justify-center">
                  <svg
                    viewBox="0 0 300 300"
                    className="w-full max-w-[260px] h-auto"
                    role="img"
                    aria-label={`${dial.label} (${dial.symbol}): ${dial.value} ${dial.unit}`}
                  >
                    {/* Outer Calibration Bezel */}
                    <circle
                      cx="150"
                      cy="150"
                      r="138"
                      fill="none"
                      stroke="#111114"
                      strokeWidth="1"
                    />

                    {/* 60 Radial Degree Tick Marks */}
                    {ticks.map((t) => (
                      <line
                        key={t.index}
                        x1={t.x1}
                        y1={t.y1}
                        x2={t.x2}
                        y2={t.y2}
                        stroke="#111114"
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
                      stroke="#111114"
                      strokeOpacity="0.14"
                      strokeWidth="4"
                    />

                    {/* Colored Active Arc Indicator */}
                    <path
                      d={activeArc}
                      fill="none"
                      stroke={dial.accent}
                      strokeWidth="5"
                      strokeLinecap="butt"
                    />

                    {/* Inner Readout Aperture */}
                    <circle
                      cx="150"
                      cy="150"
                      r="68"
                      fill="#F6F3EB"
                      stroke="#111114"
                      strokeWidth="1"
                    />

                    {/* Hairline Mechanical Pointer Needle */}
                    <line
                      x1={needleBase.x}
                      y1={needleBase.y}
                      x2={needleTip.x}
                      y2={needleTip.y}
                      stroke="#111114"
                      strokeWidth="2"
                    />
                    <circle cx={needleTip.x} cy={needleTip.y} r="3" fill={dial.accent} />

                    {/* Large Tabular JetBrains Mono Center Readout */}
                    <text
                      x="150"
                      y="146"
                      textAnchor="middle"
                      fill="#111114"
                      fontSize="20"
                      fontWeight="700"
                      className="font-mono-lab"
                    >
                      {dial.value}
                    </text>
                    <text
                      x="150"
                      y="170"
                      textAnchor="middle"
                      fill="#111114"
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

        {/* Bottom Full-Width Segmented Q = 1.00 // BREAKEVEN Bar */}
        <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div
            className="flex-1 grid grid-cols-12 sm:grid-cols-24 gap-1"
            aria-hidden="true"
            data-testid="breakeven-bar"
          >
            {Array.from({ length: segmentCount }).map((_, idx) => {
              const isFilled = idx < filledSegments;
              let fillColor = 'transparent';
              if (isFilled) {
                if (idx < 6) fillColor = '#FF1F71';
                else if (idx < 12) fillColor = '#00E676';
                else fillColor = '#1822FF';
              }
              return (
                <span
                  key={`seg-${idx}`}
                  className="block h-5 sm:h-6 border border-[#111114] arch-surface"
                  style={{ backgroundColor: fillColor }}
                />
              );
            })}
          </div>

          <div className="font-mono-lab text-xs sm:text-sm font-bold tracking-[0.08em] text-[#111114] whitespace-nowrap shrink-0 border border-[#111114] px-3.5 py-2 arch-surface">
            {CONTENT.act4.targetReadout}
          </div>
        </div>
      </div>
    </section>
  );
};
