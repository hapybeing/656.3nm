import React, { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { CONTENT } from '../data/content';
import { motionEngine } from '../engine/motionEngine';
import {
  computeCharFieldTargets,
  evaluateMhdRingPath,
  precomputeFluxEquilibrium,
  stepSpring,
  type SpringState,
} from '../physics/motionMath';
import { KineticText } from './KineticText';

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
 * Preserves Pass 1's exact Swiss exhibition poster geometry while layering:
 * 1. Choreographed entrance overlapping Act 0's wipe
 * 2. High-contrast damped-spring variable typography (zero reflow, zero setState)
 * 3. Live 14-contour 80-vertex MHD parametric magnetic flux physics + Lorentz pointer field
 */
export const Act1Hero: React.FC<Act1HeroProps> = ({ revealNonce }) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const coreGroupRef = useRef<SVGGElement | null>(null);
  const fluxPathRefs = useRef<Array<SVGPathElement | null>>([]);
  const eyebrowRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const scrollArrowRef = useRef<HTMLSpanElement | null>(null);
  const lineMaskRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const lineInnerRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const entranceDoneRef = useRef(false);
  const charNodesRef = useRef<CharPhysicsNode[]>([]);
  const svgDocBoundsRef = useRef({ left: 0, docTop: 0, width: 1, height: 1 });
  const measureSlotsRef = useRef<() => void>(() => {});

  // Precompute 14-contour 80-vertex Miller D-shaped equilibrium + resting paths once
  const fluxRings = useMemo(() => precomputeFluxEquilibrium({ samples: 80 }), []);
  const initialPaths = useMemo(
    () => fluxRings.map((ring) => evaluateMhdRingPath(ring, 0, 520, 450, 0).d),
    [fluxRings]
  );

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

      // Save and temporarily clear line-mask transforms so cached docY is exact resting position
      const savedInnerTransforms = inners.map((el) => el.style.transform);
      for (const el of inners) {
        el.style.transform = 'none';
      }

      // Temporarily reset slot widths & inline transforms so we measure natural resting widths
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
        // Lock slot width cleanly to prevent any line-wrap or horizontal reflow jitter
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

      // Restore any in-flight entrance styles cleanly
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

      if (svgRef.current) {
        const svgRect = svgRef.current.getBoundingClientRect();
        svgDocBoundsRef.current = {
          left: svgRect.left,
          docTop: svgRect.top + scrollY,
          width: Math.max(1, svgRect.width),
          height: Math.max(1, svgRect.height),
        };
      }
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
      // Hold Act 1 poised behind Act 0 shutter until reveal signal fires
      entranceDoneRef.current = false;
      const masks = lineMaskRefs.current.filter(
        (el): el is HTMLSpanElement => el !== null
      );
      const inners = lineInnerRefs.current.filter(
        (el): el is HTMLSpanElement => el !== null
      );
      const paths = fluxPathRefs.current.filter(
        (el): el is SVGPathElement => el !== null
      );
      gsap.set(masks, { overflow: 'hidden' });
      gsap.set(inners, { yPercent: 115 });
      gsap.set(paths, {
        scale: 0.82,
        opacity: 0,
        transformOrigin: '562px 450px',
      });
      gsap.set([eyebrowRef.current, footerRef.current], {
        opacity: 0,
        y: 16,
      });
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
      const paths = fluxPathRefs.current.filter(
        (el): el is SVGPathElement => el !== null
      );

      gsap.set(masks, { overflow: 'hidden' });
      gsap.set(inners, { yPercent: 115 });
      gsap.set(chars, {
        '--wght': 200,
        '--wdth': 75,
        '--opsz': 96,
      } as gsap.TweenVars);

      // Reset spring states to match entrance target smoothly at handoff
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
          // Release mask overflow so -11px elastic spring lift never clips
          gsap.set(masks, { overflow: 'visible' });
          entranceDoneRef.current = true;
          measureSlotsRef.current();
        },
      });

      // Headline lines rise out of mask while characters slam thin/compressed -> heavy/expanded
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

      // 14 nested D-shaped flux contours radiate outward from innermost core to outer shell
      paths.forEach((pathEl, idx) => {
        const targetOpacity = fluxRings[idx]?.baseOpacity ?? 0.5;
        tl.fromTo(
          pathEl,
          { scale: 0.82, opacity: 0, transformOrigin: '562px 450px' },
          {
            scale: 1,
            opacity: targetOpacity,
            duration: 0.88,
            ease: 'expo.out',
          },
          idx * 0.022
        );
      });

      // Eyebrow, bottom rule, caption, and scroll cue snap cleanly into place
      tl.to(
        [eyebrowRef.current, footerRef.current],
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.06,
          ease: 'power4.out',
        },
        0.18
      );
    }, sectionRef);

    return () => {
      ctx.revert();
    };
  }, [revealNonce, fluxRings]);

  // Shared Act 1 60fps rAF physics loop (auto-paused via IntersectionObserver when offscreen)
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

    // Smooth springs for SVG pointer coordinates, pointer strength, idle wave, & core lag
    const ptrSvgX: SpringState = { pos: 562, vel: 0 };
    const ptrSvgY: SpringState = { pos: 450, vel: 0 };
    const ptrBlend: SpringState = { pos: 0, vel: 0 };
    const idleBlend: SpringState = { pos: 0, vel: 0 };
    const coreLagX: SpringState = { pos: 0, vel: 0 };
    const coreLagY: SpringState = { pos: 0, vel: 0 };

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

      // Subtle idle wave activates gently after 1.6s of pointer inactivity
      const idleElapsed = motionEngine.timeSec - motionEngine.lastInputTimeSec;
      const targetIdle = !isPtrOnPage || idleElapsed > 1.6 ? 1 : 0;
      const targetPtrStrength = isPtrOnPage ? 1 : 0;

      stepSpring(ptrBlend, targetPtrStrength, 0.12, 0.78, dtFactor);
      stepSpring(idleBlend, targetIdle, 0.05, 0.86, dtFactor);

      const pStrength = Math.max(0, Math.min(1, ptrBlend.pos));
      const iStrength = Math.max(0, Math.min(1, idleBlend.pos));

      // 1. Live 14-Contour MHD Parametric Magnetic Flux Physics
      const svgBounds = svgDocBoundsRef.current;
      const svgViewTop = svgBounds.docTop - scrollY;
      let targetSvgX = 562;
      let targetSvgY = 450;

      if (isPtrOnPage && svgBounds.width > 1 && svgBounds.height > 1) {
        // Convert viewport pointer cleanly into SVG 900x900 viewBox space (preserveAspectRatio xMidYMid meet)
        const scale = Math.min(svgBounds.width / 900, svgBounds.height / 900);
        const renderedW = 900 * scale;
        const renderedH = 900 * scale;
        const offsetX = svgBounds.left + (svgBounds.width - renderedW) * 0.5;
        const offsetY = svgViewTop + (svgBounds.height - renderedH) * 0.5;
        targetSvgX = (rawPtrX - offsetX) / scale;
        targetSvgY = (rawPtrY - offsetY) / scale;
      }

      stepSpring(ptrSvgX, targetSvgX, 0.14, 0.74, dtFactor);
      stepSpring(ptrSvgY, targetSvgY, 0.14, 0.74, dtFactor);

      for (let i = 0; i < fluxRings.length; i++) {
        const pathEl = fluxPathRefs.current[i];
        if (!pathEl) continue;
        const { d, strokeWidth } = evaluateMhdRingPath(
          fluxRings[i],
          timeSec,
          ptrSvgX.pos,
          ptrSvgY.pos,
          pStrength
        );
        pathEl.setAttribute('d', d);
        pathEl.setAttribute('stroke-width', String(strokeWidth));
      }

      // Dynamic magnetic equilibrium lag on the central core crosshair (+)
      if (coreGroupRef.current) {
        const dxCore = (ptrSvgX.pos - 562) * 0.045 * pStrength;
        const dyCore = (ptrSvgY.pos - 450) * 0.045 * pStrength;
        const clampedDx = Math.max(-16, Math.min(16, dxCore));
        const clampedDy = Math.max(-16, Math.min(16, dyCore));
        stepSpring(coreLagX, clampedDx, 0.08, 0.8, dtFactor);
        stepSpring(coreLagY, clampedDy, 0.08, 0.8, dtFactor);
        coreGroupRef.current.setAttribute(
          'transform',
          `translate(${coreLagX.pos.toFixed(2)} ${coreLagY.pos.toFixed(2)})`
        );
      }

      // 2. Damped-Spring Variable Typography (active once entrance completes)
      if (entranceDoneRef.current) {
        const nodes = charNodesRef.current;
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          // Live viewport Y computed from cached docY - scrollY (ZERO getBoundingClientRect!)
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

      // 3. Sharp subtle hairline tick on the SCROLL ↓ arrow
      if (scrollArrowRef.current) {
        const cycle = (timeSec * 0.9) % 1;
        // Sharp expo impulse tick (0 -> 3.5px -> 0)
        const impulse =
          cycle < 0.25
            ? Math.sin((cycle / 0.25) * Math.PI) * 3.5
            : 0;
        scrollArrowRef.current.style.transform = `translate3d(0, ${impulse.toFixed(2)}px, 0)`;
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [fluxRings]);

  const handleScrollToAct2 = () => {
    motionEngine.scrollTo('#act-2');
  };

  // Split scroll cue around the arrow so we can tick the arrow subtly without changing locked copy
  const scrollParts = CONTENT.act1.scrollCue.split('↓');

  return (
    <section
      ref={sectionRef}
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
          ref={svgRef}
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
            {fluxRings.map((ring, idx) => (
              <path
                key={ring.index}
                ref={(el) => {
                  fluxPathRefs.current[idx] = el;
                }}
                d={initialPaths[idx]}
                fill="none"
                stroke={ring.stroke}
                strokeOpacity={ring.baseOpacity}
                strokeWidth="1.4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>

          {/* Exact optical core aperture reticle with magnetic equilibrium lag */}
          <g ref={coreGroupRef} data-testid="act1-core-reticle">
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
          </g>
        </svg>
      </div>

      {/* Top Structural Eyebrow Strip */}
      <div ref={eyebrowRef} className="relative z-10 w-full border-t border-[#111114]/25 pt-3">
        <p className="font-mono-lab text-[10px] sm:text-xs tracking-[0.08em] text-[#111114]">
          {CONTENT.act1.eyebrow}
        </p>
      </div>

      {/* Monumental Display Headline — Anchored with Swiss Negative Space */}
      <div className="relative z-10 my-auto py-8 sm:py-12 md:py-14">
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

      {/* Bottom 1px Architectural Footer Strip */}
      <div
        ref={footerRef}
        className="relative z-10 w-full border-t border-[#111114] pt-3.5 sm:pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3"
      >
        <p className="font-mono-lab text-[11px] sm:text-xs md:text-[13px] tracking-[0.06em] text-[#111114] max-w-xl">
          {CONTENT.act1.captionLeft}
        </p>
        <button
          type="button"
          onClick={handleScrollToAct2}
          data-testid="act1-scroll-cue"
          className="font-mono-lab text-[11px] sm:text-xs tracking-[0.08em] text-[#111114] whitespace-nowrap shrink-0 w-fit sm:mr-8 border border-[#111114] px-3 py-1.5 min-h-[40px] arch-surface bg-[#F6F3EB] cursor-pointer inline-flex items-center gap-1.5"
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
