/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { CONTENT } from './data/content';
import { SwissChrome } from './components/SwissChrome';
import { Act1Hero } from './components/Act1Hero';
import { Act2Lithium } from './components/Act2Lithium';
import { Act3Cage } from './components/Act3Cage';
import { Act4Ignition } from './components/Act4Ignition';
import { Act5Epilogue } from './components/Act5Epilogue';

export default function App() {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [activeAct, setActiveAct] = useState<'1' | '2' | '3' | '4' | '5'>('1');

  // Determine chrome ink luminance strictly from the visible Act + active Act 2 stage
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-act]')
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio)
          ) {
            bestEntry = entry;
          }
        }
        if (bestEntry) {
          const actId = bestEntry.target.getAttribute('data-act') as
            | '1'
            | '2'
            | '3'
            | '4'
            | '5'
            | null;
          if (actId) {
            setActiveAct(actId);
          }
        }
      },
      {
        threshold: [0.25, 0.5, 0.75],
        rootMargin: '-15% 0px -15% 0px',
      }
    );

    for (const el of sections) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const act2Stage = CONTENT.act2.stages[activeStageIndex] ?? CONTENT.act2.stages[0];
  let chromeInkMode: 'dark' | 'light' = 'dark';
  if (activeAct === '3' || activeAct === '5') {
    chromeInkMode = 'light';
  } else if (activeAct === '2') {
    chromeInkMode = act2Stage.ink === '#F6F3EB' ? 'light' : 'dark';
  }

  return (
    <div className="relative w-full min-h-screen bg-[#F6F3EB] text-[#111114]">
      <SwissChrome
        inkMode={chromeInkMode}
        activeStageIndex={activeStageIndex}
      />

      <main className="relative z-10 w-full">
        <Act1Hero />
        <Act2Lithium
          activeStageIndex={activeStageIndex}
          onSelectStage={setActiveStageIndex}
        />
        <Act3Cage />
        <Act4Ignition />
      </main>

      <Act5Epilogue />
    </div>
  );
}
