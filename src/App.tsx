/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { CONTENT } from './data/content';
import { motionEngine } from './engine/motionEngine';
import { Act0Shutter } from './components/Act0Shutter';
import { SwissChrome } from './components/SwissChrome';
import { Act1Hero } from './components/Act1Hero';
import { Act2Lithium } from './components/Act2Lithium';
import { Act3Cage } from './components/Act3Cage';
import { Act4Ignition } from './components/Act4Ignition';
import { Act5Epilogue } from './components/Act5Epilogue';

type ActId = '1' | '2' | '3' | '4' | '5';

export default function App() {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [activeAct, setActiveAct] = useState<ActId>('1');
  const [act4Ignited, setAct4Ignited] = useState(false);
  const [shutterReplayNonce, setShutterReplayNonce] = useState(0);
  const [act1RevealNonce, setAct1RevealNonce] = useState(0);

  // Boot global 60fps Lenis + GSAP ticker Motion Engine (StrictMode cleanup safe)
  useEffect(() => {
    motionEngine.init();
    return () => {
      motionEngine.destroy();
    };
  }, []);

  // Track active Act cleanly via IntersectionObserver (zero scroll-event setState)
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-act]')
    );
    if (sections.length === 0) return;

    const ratios = new Map<ActId, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-act') as ActId | null;
          if (id) {
            ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
          }
        }

        let bestId: ActId | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios.entries()) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }

        if (bestId) {
          setActiveAct(bestId);
        }
      },
      {
        threshold: [0.1, 0.25, 0.45, 0.65, 0.85],
        rootMargin: '-12% 0px -12% 0px',
      }
    );

    for (const el of sections) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const handleTriggerAct1Reveal = useCallback(() => {
    setAct1RevealNonce((n) => n + 1);
  }, []);

  const handleReplayShutter = useCallback(() => {
    setShutterReplayNonce((n) => n + 1);
  }, []);

  const act2Stage = CONTENT.act2.stages[activeStageIndex] ?? CONTENT.act2.stages[0];
  const baseMeta = CONTENT.chrome.actMeta[activeAct];

  let chromeInkMode: 'dark' | 'light' = baseMeta.ink;
  let activeWavelength: string = baseMeta.wavelength;
  let activeSwatch: string = baseMeta.swatch;

  if (activeAct === '2') {
    chromeInkMode = act2Stage.ink === '#F6F3EB' ? 'light' : 'dark';
    activeWavelength = act2Stage.tabLabel;
    activeSwatch = act2Stage.bg;
  } else if (activeAct === '4' && act4Ignited) {
    chromeInkMode = 'light';
    activeWavelength = '0.01nm X-RAY';
    activeSwatch = '#FFB800';
  }

  return (
    <div className="relative w-full min-h-screen bg-[#F6F3EB] text-[#111114]">
      <Act0Shutter
        replayNonce={shutterReplayNonce}
        onTriggerAct1Reveal={handleTriggerAct1Reveal}
      />

      <SwissChrome
        inkMode={chromeInkMode}
        activeAct={activeAct}
        activeStageIndex={activeStageIndex}
        activeWavelength={activeWavelength}
        activeSwatch={activeSwatch}
        onReplayShutter={handleReplayShutter}
      />

      <main className="relative z-10 w-full">
        <Act1Hero revealNonce={act1RevealNonce} />
        <Act2Lithium
          activeStageIndex={activeStageIndex}
          onSelectStage={setActiveStageIndex}
        />
        <Act3Cage />
        <Act4Ignition onIgnitedChange={setAct4Ignited} />
      </main>

      <Act5Epilogue />
    </div>
  );
}
