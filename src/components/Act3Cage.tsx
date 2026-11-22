import React, { useMemo, useState } from 'react';
import { CONTENT, type CageMode } from '../data/content';
import {
  generateCirclePath,
  generateStellaratorGeometry,
  generateTokamakGeometry,
} from '../physics/geometry';
import { KineticText } from './KineticText';

/**
 * ACT 03 — THE MAGNETIC CAGE (Interactive Topology Lab)
 * Full-bleed Balmer Cobalt (#1822FF) + Acid Tungsten (#EAFF2B) asymmetric Swiss poster.
 * Compares symmetric Tokamak toroidal flux coils against a 5-fold twisted Stellarator
 * ribbon knot with edge magnetic islands, encircled by a circular <textPath> ring.
 */
export const Act3Cage: React.FC = () => {
  const [mode, setMode] = useState<CageMode>('tokamak');

  const tokamak = useMemo(() => generateTokamakGeometry(300, 300), []);
  const stellarator = useMemo(() => generateStellaratorGeometry(300, 300), []);
  const ringTextPath = useMemo(() => generateCirclePath(300, 300, 248), []);
  const repeatedRingText = `${CONTENT.act3.fieldRingText}${CONTENT.act3.fieldRingText}${CONTENT.act3.fieldRingText}`;

  return (
    <section
      id="act-3"
      data-act="3"
      data-act-ink="light"
      data-cage-mode={mode}
      className="relative min-h-[100svh] w-full bg-[#1822FF] text-[#F6F3EB] flex flex-col justify-between px-4 sm:px-6 md:px-10 pt-16 sm:pt-20 pb-20 sm:pb-20 border-b border-[#111114] overflow-hidden"
    >
      {/* Top Eyebrow Strip */}
      <div className="relative z-10 w-full border-t border-[rgba(246,243,235,0.28)] pt-3">
        <p className="font-mono-lab text-[10px] sm:text-xs tracking-[0.08em] text-[#F6F3EB]">
          {CONTENT.act3.eyebrow}
        </p>
      </div>

      {/* Asymmetric 2-Column Swiss Poster Grid */}
      <div className="relative z-10 my-auto py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        {/* Left Column: Acid Tungsten Headline + Hairline Mode Tabs */}
        <div className="lg:col-span-6 flex flex-col gap-8">
          <h2 className="cage-headline k-font-bricolage font-extrabold uppercase text-[#EAFF2B]">
            {CONTENT.act3.headlineLines.map((line, idx) => (
              <span key={line} className="block">
                <KineticText
                  text={line}
                  font="bricolage"
                  charStartIndex={idx * 16}
                />
              </span>
            ))}
          </h2>

          {/* Square-Cornered Hairline Topology Toggle */}
          <div
            className="flex flex-col sm:flex-row items-stretch w-full sm:w-fit border border-[#F6F3EB] arch-surface"
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
                  className={`font-mono-lab text-[11px] sm:text-xs font-semibold tracking-[0.05em] px-4 py-3 min-h-[44px] arch-surface whitespace-nowrap shrink-0 cursor-pointer border-b sm:border-b-0 sm:border-r last:border-b-0 last:border-r-0 border-[#F6F3EB] ${
                    isActive
                      ? 'bg-[#EAFF2B] text-[#1822FF]'
                      : 'bg-transparent text-[#F6F3EB]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Precision Parametric Confinement SVG */}
        <div className="lg:col-span-6 flex items-center justify-center">
          <svg
            viewBox="0 0 600 600"
            className="w-full max-w-[460px] lg:max-w-[540px] h-auto"
            role="img"
            aria-label={
              mode === 'tokamak'
                ? 'Tokamak symmetric toroidal magnetic confinement coils'
                : 'Stellarator 5-fold twisted helical magnetic flux knot with edge islands'
            }
            data-testid="act3-cage-svg"
          >
            <defs>
              <path id="cage-field-ring-path" d={ringTextPath} />
            </defs>

            {/* Outer Blueprint Reticle */}
            <circle
              cx="300"
              cy="300"
              r="272"
              fill="none"
              stroke="#F6F3EB"
              strokeOpacity="0.24"
              strokeWidth="1"
            />
            <circle
              cx="300"
              cy="300"
              r="224"
              fill="none"
              stroke="#F6F3EB"
              strokeOpacity="0.24"
              strokeWidth="1"
            />
            <line
              x1="300"
              y1="20"
              x2="300"
              y2="580"
              stroke="#F6F3EB"
              strokeOpacity="0.16"
              strokeWidth="1"
            />
            <line
              x1="20"
              y1="300"
              x2="580"
              y2="300"
              stroke="#F6F3EB"
              strokeOpacity="0.16"
              strokeWidth="1"
            />

            {/* Curved SVG <textPath> Field Ring */}
            <text
              fill="#F6F3EB"
              fontSize="10.2"
              letterSpacing="1.65"
              className="font-mono-lab"
            >
              <textPath href="#cage-field-ring-path" startOffset="0%">
                {repeatedRingText}
              </textPath>
            </text>

            {/* Active Confinement Geometry */}
            {mode === 'tokamak' ? (
              <g data-testid="tokamak-geometry">
                {/* Radial toroidal coil ribs */}
                {tokamak.radialSpokes.map((spoke, i) => (
                  <line
                    key={`spoke-${i}`}
                    x1={spoke.x1}
                    y1={spoke.y1}
                    x2={spoke.x2}
                    y2={spoke.y2}
                    stroke="#F6F3EB"
                    strokeOpacity="0.32"
                    strokeWidth="1"
                  />
                ))}

                {/* Outer magnet coil shoes */}
                {tokamak.outerCoils.map((coil, i) => (
                  <path
                    key={`coil-${i}`}
                    d={coil.d}
                    fill="none"
                    stroke="#EAFF2B"
                    strokeWidth="1.25"
                  />
                ))}

                {/* Concentric toroidal flux surfaces */}
                {tokamak.concentricRadii.map((r, i) => (
                  <circle
                    key={`ring-${r}`}
                    cx="300"
                    cy="300"
                    r={r}
                    fill="none"
                    stroke={i % 2 === 0 ? '#EAFF2B' : '#F6F3EB'}
                    strokeOpacity={i === 2 || i === 3 ? 1 : 0.65}
                    strokeWidth={i === 2 || i === 3 ? 2 : 1.25}
                  />
                ))}

                {/* Central Solenoid Core */}
                <circle
                  cx="300"
                  cy="300"
                  r="42"
                  fill="none"
                  stroke="#F6F3EB"
                  strokeWidth="1.5"
                />
                <circle
                  cx="300"
                  cy="300"
                  r="14"
                  fill="none"
                  stroke="#EAFF2B"
                  strokeWidth="1.5"
                />
              </g>
            ) : (
              <g data-testid="stellarator-geometry">
                {/* 5-Fold Twisted Stellarator Ribbon Knot */}
                {stellarator.ribbons.map((ribbon) => (
                  <path
                    key={`ribbon-${ribbon.phaseIndex}`}
                    d={ribbon.d}
                    fill="none"
                    stroke={
                      ribbon.phaseIndex % 2 === 0 ? '#EAFF2B' : '#00D8FF'
                    }
                    strokeOpacity={ribbon.phaseIndex % 2 === 0 ? 0.92 : 0.72}
                    strokeWidth={ribbon.phaseIndex === 3 ? 2 : 1.35}
                  />
                ))}

                {/* Helical Magnetic Axis */}
                <path
                  d={stellarator.coreAxis}
                  fill="none"
                  stroke="#F6F3EB"
                  strokeWidth="1.25"
                  strokeDasharray="5 5"
                />

                {/* 5 Edge Magnetic Islands */}
                {stellarator.islands.map((island, idx) => (
                  <g key={`island-${idx}`}>
                    <path
                      d={island.d}
                      fill="#FF1F71"
                      fillOpacity="0.22"
                      stroke="#EAFF2B"
                      strokeWidth="1.5"
                    />
                    <circle cx={island.cx} cy={island.cy} r="2.5" fill="#EAFF2B" />
                  </g>
                ))}
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Bottom ΔT Telemetry Strip */}
      <div className="relative z-10 w-full border-t border-[rgba(246,243,235,0.45)] pt-3.5 sm:pt-4">
        <p className="font-mono-lab text-[11px] sm:text-xs md:text-[13px] tracking-[0.06em] text-[#F6F3EB]">
          {CONTENT.act3.telemetryStrip}
        </p>
      </div>
    </section>
  );
};
