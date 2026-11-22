import React, { useMemo } from 'react';
import { CONTENT } from '../data/content';
import { generateMagneticFluxContours } from '../physics/geometry';
import { KineticText } from './KineticText';

/**
 * ACT 01 — THE INVISIBLE CORE (Hero)
 * Ceramic Lab Paper (#F6F3EB) + 14 nested parametric D-shaped magnetic flux contours
 * behind monumental Bricolage Grotesque edge-to-edge typography.
 */
export const Act1Hero: React.FC = () => {
  const contours = useMemo(() => generateMagneticFluxContours(), []);

  return (
    <section
      id="act-1"
      data-act="1"
      data-act-ink="dark"
      className="relative min-h-[100svh] w-full bg-[#F6F3EB] text-[#111114] flex flex-col justify-between overflow-hidden px-4 sm:px-6 md:px-10 pt-16 sm:pt-20 pb-20 sm:pb-20 border-b border-[#111114]"
    >
      {/* Parametric 14-contour Magnetic Flux SVG Field (Right-weighted Swiss asymmetry) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-16 bottom-28 flex items-center justify-end pr-0 md:pr-[4vw]"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 900 900"
          className="w-[96vw] max-w-[740px] sm:w-[74vw] md:w-[58vw] lg:w-[50vw] h-full max-h-[72svh]"
          data-testid="act1-flux-svg"
        >
          {/* Magnetic axis calibration crosshairs (invisible 150M K X-ray center) */}
          <line
            x1="562"
            y1="90"
            x2="562"
            y2="810"
            stroke="#111114"
            strokeOpacity="0.14"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <line
            x1="210"
            y1="450"
            x2="830"
            y2="450"
            stroke="#111114"
            strokeOpacity="0.14"
            strokeWidth="1"
            strokeDasharray="4 6"
          />

          {/* 14 Nested D-shaped / Bean-shaped Magnetic Flux Contours */}
          <g data-flux-group="contours">
            {contours.map((contour) => (
              <path
                key={contour.index}
                d={contour.d}
                fill="none"
                stroke={contour.stroke}
                strokeOpacity={contour.opacity}
                strokeWidth={contour.strokeWidth}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>

          {/* Exact optical core aperture reticle */}
          <circle
            cx="562"
            cy="450"
            r="5"
            fill="none"
            stroke="#FF1F71"
            strokeWidth="1.5"
          />
          <line x1="550" y1="450" x2="574" y2="450" stroke="#111114" strokeWidth="1" />
          <line x1="562" y1="438" x2="562" y2="462" stroke="#111114" strokeWidth="1" />
        </svg>
      </div>

      {/* Top Structural Eyebrow Strip */}
      <div className="relative z-10 w-full border-t border-[#111114]/25 pt-3">
        <p className="font-mono-lab text-[10px] sm:text-xs tracking-[0.08em] text-[#111114]">
          {CONTENT.act1.eyebrow}
        </p>
      </div>

      {/* Monumental Display Headline — Anchored with Swiss Negative Space */}
      <div className="relative z-10 my-auto py-8 sm:py-12 md:py-14">
        <h1 className="hero-headline k-font-bricolage font-extrabold uppercase tracking-tight">
          {CONTENT.act1.headlineLines.map((line, idx) => (
            <span
              key={line}
              className={`block ${idx === 2 ? 'text-[#FF1F71]' : 'text-[#111114]'}`}
            >
              <KineticText
                text={line}
                font="bricolage"
                charStartIndex={idx * 20}
              />
            </span>
          ))}
        </h1>
      </div>

      {/* Bottom 1px Architectural Footer Strip */}
      <div className="relative z-10 w-full border-t border-[#111114] pt-3.5 sm:pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <p className="font-mono-lab text-[11px] sm:text-xs md:text-[13px] tracking-[0.06em] text-[#111114] max-w-xl">
          {CONTENT.act1.captionLeft}
        </p>
        <div className="font-mono-lab text-[11px] sm:text-xs tracking-[0.08em] text-[#111114] whitespace-nowrap shrink-0 w-fit sm:mr-8 border border-[#111114] px-3 py-1.5 arch-surface bg-[#F6F3EB]">
          {CONTENT.act1.scrollCue}
        </div>
      </div>
    </section>
  );
};
