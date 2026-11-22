import React from 'react';
import { CONTENT } from '../data/content';
import { KineticText } from './KineticText';

/**
 * ACT 05 — EPILOGUE
 * Solar Gold (#FFB800) ticker slamming into Carbon Tungsten (#111114) above a massive
 * full-width 656.3nm wordmark and minimal 1px colophon footer.
 */
export const Act5Epilogue: React.FC = () => {
  return (
    <footer
      id="act-5"
      data-act="5"
      data-act-ink="light"
      className="relative w-full bg-[#111114] text-[#F6F3EB] flex flex-col justify-between overflow-hidden"
    >
      {/* Opposing Typographic Ticker Strips */}
      <div className="w-full">
        {/* Band A — Solar Epilogue Gold (#FFB800) */}
        <div className="w-full bg-[#FFB800] text-[#111114] border-b border-[#111114] py-3.5 sm:py-4 overflow-hidden">
          <div className="flex items-center whitespace-nowrap font-mono-lab text-xs sm:text-sm font-bold tracking-[0.08em]">
            <span className="px-4 shrink-0">{CONTENT.act5.bandA}</span>
            <span className="px-4 shrink-0" aria-hidden="true">
              {CONTENT.act5.bandA}
            </span>
          </div>
        </div>

        {/* Band B — Carbon Tungsten (#111114) with Balmer Pink & Cyan spectral dividers */}
        <div className="w-full bg-[#111114] text-[#F6F3EB] border-b border-[rgba(246,243,235,0.22)] py-3.5 sm:py-4 overflow-hidden">
          <div className="flex items-center whitespace-nowrap font-mono-lab text-xs sm:text-sm font-medium tracking-[0.08em]">
            <span className="px-4 shrink-0">{CONTENT.act5.bandB}</span>
            <span
              className="inline-block w-0.5 h-4 bg-[#FF1F71] shrink-0"
              aria-hidden="true"
            />
            <span className="px-4 shrink-0" aria-hidden="true">
              {CONTENT.act5.bandB}
            </span>
            <span
              className="inline-block w-0.5 h-4 bg-[#00D8FF] shrink-0"
              aria-hidden="true"
            />
            <span className="px-4 shrink-0" aria-hidden="true">
              {CONTENT.act5.bandB}
            </span>
          </div>
        </div>
      </div>

      {/* Massive Full-Width 656.3nm Wordmark Stage */}
      <div className="w-full px-4 sm:px-6 md:px-10 pt-16 sm:pt-24 md:pt-28 pb-12 sm:pb-16 flex flex-col justify-end">
        <div className="w-full flex items-center justify-center overflow-hidden py-4">
          <div
            className="epilogue-wordmark k-font-bricolage font-extrabold text-[#F6F3EB] select-none text-center whitespace-nowrap"
            data-testid="epilogue-wordmark"
          >
            <KineticText text={CONTENT.act5.wordmark} font="bricolage" />
          </div>
        </div>

        {/* Minimal 1px Colophon Footer */}
        <div className="mt-10 sm:mt-14 pt-4 pb-10 sm:pb-12 border-t border-[rgba(246,243,235,0.26)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-mono-lab text-[10px] sm:text-xs tracking-[0.08em] text-[#F6F3EB]/85">
          <span>{CONTENT.act5.colophon}</span>
          <span>{CONTENT.brand}</span>
        </div>
      </div>
    </footer>
  );
};
