import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { CONTENT } from '../data/content';
import { motionEngine } from '../engine/motionEngine';
import {
  computeCharFieldTargets,
  stepSpring,
  type SpringState,
} from '../physics/motionMath';
import { KineticText } from './KineticText';
import { Act1Toroid3D } from './three/Act1Toroid3D';

export interface Act1HeroProps {
  revealNonce: number;
}

interface CharPhysicsNode {
  el: HTMLElement;
  docX: number;
  docY: number;
  wght: SpringState;
  wdth: SpringState;
  opsz: SpringState;
  y: SpringState;
  rot: SpringState;
  chroma: SpringState;
}

/**
 * ACT 01 — THE INVISIBLE CORE (Hero)
 * Brutally decluttered Swiss gallery composition on Ceramic Paper (#F6F3EB):
 * - Monumental kinetic Bricolage Grotesque headline ("150 MILLION / DEGREES IS / INVISIBLE.")
 *   with damped-spring variable typography (zero reflow, zero setState)
 * - Huge sculptural 3D Optical Plasma Toroid (Act1Toroid3D: Miller D-shaped GLSL "Invisible Core"
 *   Fresnel plasma wrapped inside 12 glossy metallic D-shaped magnetic coils)
 * - Crisp SCROLL ↓ 656.28nm button
 * Zero muted eyebrow text, zero bottom caption paragraph, zero faint grey gridlines.
 */
export const Act1Hero: React.FC<Act1HeroProps> = ({ revealNonce }) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const toroidWrapRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const scrollArrowRef = useRef<HTMLSpanElement | null>(null);
  const lineMaskRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const lineInnerRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const entranceDoneRef = useRef(false);
  const charNodesRef = useRef<CharPhysicsNode[]>([]);
  const measureSlotsRef = useRef<() => void>(() => {});

  // Measure and lock natural character slot widths + cache document coordinates (zero reflow in rAF)
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let resizeTimer: number | null = null;

    const measureSlots = () => {
      const charEls = Array.from(
        section.querySelectorAll<HTMLElement>('.k-char')
      );
      const inners = lineInnerRefs.current.filter(
        (el): el is HTMLSpanElement => el !== null
      );

      const savedInnerTransforms = inners.map((el) => el.style.transform);
      for (const el of inners) {
        el.style.transform = 'none';
      }

      const savedCharStyles = charEls.map((el) => ({
        transform: el.style.transform,
        wght: el.style.getPropertyValue('--wght'),
        wdth: el.style.getPropertyValue('--wdth'),
        opsz: el.style.getPropertyValue('--opsz'),
      }));

      for (const el of charEls) {
        el.style.width = '';
        el.style.transform = '';
        el.style.setProperty('--wght', '800');
        el.style.setProperty('--wdth', '92');
        el.style.setProperty('--opsz', '96');
      }

      const scrollY = window.scrollY;
      const existing = charNodesRef.current;
      const nextNodes: CharPhysicsNode[] = [];

      for (let i = 0; i < charEls.length; i++) {
        const el = charEls[i];
        const rect = el.getBoundingClientRect();
        el.style.width = `${Math.ceil(rect.width)}px`;

        const prev = existing[i];
        nextNodes.push({
          el,
          docX: rect.left + rect.width * 0.5,
          docY: rect.top + scrollY + rect.height * 0.5,
          wght: prev ? prev.wght : { pos: 800, vel: 0 },
          wdth: prev ? prev.wdth : { pos: 92, vel: 0 },
          opsz: prev ? prev.opsz : { pos: 96, vel: 0 },
          y: prev ? prev.y : { pos: 0, vel: 0 },
          rot: prev ? prev.rot : { pos: 0, vel: 0 },
          chroma: prev ? prev.chroma : { pos: 0, vel: 0 },
        });
      }

      for (let i = 0; i < inners.length; i++) {
        inners[i].style.transform = savedInnerTransforms[i];
      }
      if (!entranceDoneRef.current) {
        for (let i = 0; i < charEls.length; i++) {
          const saved = savedCharStyles[i];
          if (saved.transform) charEls[i].style.transform = saved.transform;
          if (saved.wght) charEls[i].style.setProperty('--wght', saved.wght);
          if (saved.wdth) charEls[i].style.setProperty('--wdth', saved.wdth);
          if (saved.opsz) charEls[i].style.setProperty('--opsz', saved.opsz);
        }
      }

      charNodesRef.current = nextNodes;
    };

    measureSlotsRef.current = measureSlots;

    const waitFonts = document.fonts?.ready ?? Promise.resolve();
    waitFonts.then(() => {
      measureSlots();
    });

    const onResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measureSlots, 140);
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    };
  }, []);

  // Choreographed Entrance overlapping Act 0's clip-path wipe
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (revealNonce === 0 && !prefersReducedMotion) {
      entranceDoneRef.current = false;
      const masks = lineMaskRefs.current.filter(
        (el): el is HTMLSpanElement => el !== null
      );
      const inners = lineInnerRefs.current.filter(
        (el): el is HTMLSpanElement => el !== null
      );
      gsap.set(masks, { overflow: 'hidden' });
      gsap.set(inners, { yPercent: 115 });
      if (toroidWrapRef.current) {
        gsap.set(toroidWrapRef.current, { scale: 0.86, opacity: 0 });
      }
      if (footerRef.current) {
        gsap.set(footerRef.current, { opacity: 0, y: 16 });
      }
      return;
    }

    if (prefersReducedMotion) {
      entranceDoneRef.current = true;
      measureSlotsRef.current();
      return;
    }

    const ctx = gsap.context(() => {
      entranceDoneRef.current = false;

      const masks = lineMaskRefs.current.filter(
        (el): el is HTMLSpanElement => el !== null
      );
      const inners = lineInnerRefs.current.filter(
        (el): el is HTMLSpanElement => el !== null
      );
      const chars = Array.from(section.querySelectorAll<HTMLElement>('.k-char'));

      gsap.set(masks, { overflow: 'hidden' });
      gsap.set(inners, { yPercent: 115 });
      gsap.set(chars, {
        '--wght': 200,
        '--wdth': 75,
        '--opsz': 96,
      } as gsap.TweenVars);

      for (const node of charNodesRef.current) {
        node.wght.pos = 800;
        node.wght.vel = 0;
        node.wdth.pos = 92;
        node.wdth.vel = 0;
        node.opsz.pos = 96;
        node.opsz.vel = 0;
        node.y.pos = 0;
        node.y.vel = 0;
        node.rot.pos = 0;
        node.rot.vel = 0;
        node.chroma.pos = 0;
        node.chroma.vel = 0;
      }

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(masks, { overflow: 'visible' });
          entranceDoneRef.current = true;
          measureSlotsRef.current();
        },
      });

      tl.to(
        inners,
        {
          yPercent: 0,
          duration: 0.88,
          stagger: 0.08,
          ease: 'expo.out',
        },
        0
      );

      tl.to(
        chars,
        {
          '--wght': 800,
          '--wdth': 92,
          duration: 0.88,
          stagger: 0.016,
          ease: 'expo.out',
        } as gsap.TweenVars,
        0
      );

      if (toroidWrapRef.current) {
        tl.to(
          toroidWrapRef.current,
          {
            scale: 1,
            opacity: 1,
            duration: 1.0,
            ease: 'expo.out',
          },
          0.04
        );
      }

      if (footerRef.current) {
        tl.to(
          footerRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power4.out',
          },
          0.18
        );
      }
    }, sectionRef);

    return () => {
      ctx.revert();
    };
  }, [revealNonce]);

  // Shared Act 1 60fps damped-spring variable typography loop (paused offscreen)
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReducedMotion) return;

    let isVisible = true;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisible = entry.isIntersecting;
        }
      },
      { threshold: 0.01 }
    );
    observer.observe(section);

    const ptrBlend: SpringState = { pos: 0, vel: 0 };
    const idleBlend: SpringState = { pos: 0, vel: 0 };

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (!isVisible) {
        lastTs = now;
        return;
      }

      const dtMs = Math.min(48, Math.max(4, now - lastTs));
      lastTs = now;
      const dtFactor = dtMs / 16.6667;
      const timeSec = now * 0.001;

      const scrollY = motionEngine.scrollY;
      const rawPtrX = motionEngine.pointerX;
      const rawPtrY = motionEngine.pointerY;
      const isPtrOnPage = motionEngine.pointerActive && rawPtrX >= 0 && rawPtrY >= 0;

      const idleElapsed = motionEngine.timeSec - motionEngine.lastInputTimeSec;
      const targetIdle = !isPtrOnPage || idleElapsed > 1.6 ? 1 : 0;
      const targetPtrStrength = isPtrOnPage ? 1 : 0;

      stepSpring(ptrBlend, targetPtrStrength, 0.12, 0.78, dtFactor);
      stepSpring(idleBlend, targetIdle, 0.05, 0.86, dtFactor);

      const pStrength = Math.max(0, Math.min(1, ptrBlend.pos));
      const iStrength = Math.max(0, Math.min(1, idleBlend.pos));

      if (entranceDoneRef.current) {
        const nodes = charNodesRef.current;
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          const liveY = node.docY - scrollY;

          const targets = computeCharFieldTargets({
            charX: node.docX,
            charY: liveY,
            pointerX: rawPtrX,
            pointerY: rawPtrY,
            pointerStrength: pStrength,
            idleStrength: iStrength,
            timeSec,
            radius: 230,
          });

          stepSpring(node.wght, targets.wght, 0.14, 0.72, dtFactor);
          stepSpring(node.wdth, targets.wdth, 0.14, 0.72, dtFactor);
          stepSpring(node.opsz, targets.opsz, 0.14, 0.72, dtFactor);
          stepSpring(node.y, targets.y, 0.14, 0.72, dtFactor);
          stepSpring(node.rot, targets.rot, 0.14, 0.72, dtFactor);
          stepSpring(node.chroma, targets.chroma, 0.16, 0.72, dtFactor);

          const s = node.el.style;
          const clampedWght = Math.max(200, Math.min(800, node.wght.pos));
          const clampedWdth = Math.max(75, Math.min(100, node.wdth.pos));
          const clampedOpsz = Math.max(12, Math.min(96, node.opsz.pos));

          s.setProperty('--wght', clampedWght.toFixed(1));
          s.setProperty('--wdth', clampedWdth.toFixed(2));
          s.setProperty('--opsz', clampedOpsz.toFixed(1));

          if (Math.abs(node.y.pos) > 0.03 || Math.abs(node.rot.pos) > 0.02) {
            s.transform = `translate3d(0, ${node.y.pos.toFixed(2)}px, 0) rotate(${node.rot.pos.toFixed(2)}deg)`;
          } else {
            s.transform = '';
          }

          if (node.chroma.pos > 0.08) {
            const c = node.chroma.pos.toFixed(2);
            s.textShadow = `${c}px 0 0 rgba(255, 31, 113, 0.72), -${c}px 0 0 rgba(0, 216, 255, 0.72)`;
          } else {
            s.textShadow = '';
          }
        }
      }

      if (scrollArrowRef.current) {
        const cycle = (timeSec * 0.9) % 1;
        const impulse =
          cycle < 0.25 ? Math.sin((cycle / 0.25) * Math.PI) * 3.5 : 0;
        scrollArrowRef.current.style.transform = `translate3d(0, ${impulse.toFixed(2)}px, 0)`;
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  const handleScrollToAct2 = () => {
    motionEngine.scrollTo('#act-2');
  };

  const scrollParts = CONTENT.act1.scrollCue.split('↓');

  return (
    <section
      ref={sectionRef}
      id="act-1"
      data-act="1"
      data-act-ink="dark"
      className="relative min-h-[100svh] w-full bg-[#F6F3EB] text-[#111114] flex flex-col justify-between overflow-hidden px-4 sm:px-6 md:px-10 pt-16 sm:pt-20 pb-8 sm:pb-10"
    >
      {/* Huge Sculptural 3D Optical Plasma Toroid (Right-Weighted Swiss Gallery Asymmetry) */}
      <div
        ref={toroidWrapRef}
        className="pointer-events-none absolute top-4 bottom-14 sm:bottom-16 right-0 left-0 sm:left-[38%] md:left-[44%] lg:left-[46%] flex items-center justify-center sm:justify-end sm:pr-4 md:pr-6 z-[2]"
        aria-hidden="true"
      >
        <Act1Toroid3D className="w-[106vw] h-[72svh] sm:w-full sm:h-[78svh] md:h-[80svh] max-w-[780px] max-h-[720px]" />
      </div>

      {/* Top Spacer preserving clean Swiss breathing room under fixed top-left badge */}
      <div className="h-4 shrink-0" aria-hidden="true" />

      {/* Monumental Display Headline — Anchored Left with Dramatic Gallery Separation */}
      <div className="relative z-10 my-auto py-6 sm:py-10 sm:max-w-[60%] lg:max-w-[58%]">
        <h1 className="hero-headline k-font-bricolage uppercase tracking-tight doppler-heading doppler-shear">
          {CONTENT.act1.headlineLines.map((line, idx) => (
            <span
              key={line}
              ref={(el) => {
                lineMaskRefs.current[idx] = el;
              }}
              className="block overflow-hidden"
            >
              <span
                ref={(el) => {
                  lineInnerRefs.current[idx] = el;
                }}
                className={`block ${idx === 2 ? 'text-[#FF1F71]' : 'text-[#111114]'}`}
              >
                <KineticText
                  text={line}
                  font="bricolage"
                  charStartIndex={idx * 20}
                />
              </span>
            </span>
          ))}
        </h1>
      </div>

      {/* Bottom Right ONLY: Crisp High-Contrast SCROLL ↓ 656.28nm Action */}
      <div
        ref={footerRef}
        className="relative z-10 w-full flex items-center justify-end"
      >
        <button
          type="button"
          onClick={handleScrollToAct2}
          data-testid="act1-scroll-cue"
          className="font-mono-lab text-[11px] sm:text-xs font-bold tracking-[0.08em] text-[#F6F3EB] whitespace-nowrap shrink-0 w-fit mr-4 sm:mr-8 border border-[#111114] px-3.5 py-2 min-h-[40px] arch-surface bg-[#111114] hover:bg-[#FF1F71] hover:border-[#FF1F71] cursor-pointer inline-flex items-center gap-1.5 chrome-ink-transition"
        >
          <span>{scrollParts[0].trim()}</span>
          <span
            ref={scrollArrowRef}
            className="inline-block mr-1"
            aria-hidden="true"
          >
            ↓
          </span>
          <span>{(scrollParts[1] ?? '').trim()}</span>
        </button>
      </div>
    </section>
  );
};
