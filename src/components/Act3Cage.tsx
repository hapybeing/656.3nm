import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONTENT, type CageMode } from '../data/content';
import { spectralAudio } from '../engine/spectralAudio';
import { generateCirclePath } from '../physics/geometry';
import {
  computeHeadlinePinch,
  computeMagneticPressureMPa,
  evaluateMagneticAxisPoint,
  evaluateMagneticIslandPoint,
  evaluateModularCoilPoint,
  evaluatePlasmaSurfacePoint,
  projectPoint3D,
  type CagePhysicsParams,
} from '../physics/cage3dMath';
import { clamp, stepSpring, type SpringState } from '../physics/motionMath';
import { KineticText } from './KineticText';

gsap.registerPlugin(ScrollTrigger);

/**
 * ACT 03 — THE MAGNETIC CAGE (Live 3D-Projected Parametric Tokamak <-> Stellarator Engine)
 * Full-bleed Balmer Cobalt (#1822FF) + Acid Tungsten (#EAFF2B):
 * - High-DPI HTML5 Canvas 2D 3D parametric manifold (zero Three.js, 60fps)
 * - Continuous morphT (0 -> 1) between axisymmetric D-shaped Tokamak & 5-fold W7-X Stellarator
 * - 18 superconducting coils, helical field lines (q=3.1), relativistic vector tracer pulses,
 *   hot #FF1F71 magnetic axis filament, & 5 Stellarator edge magnetic island chains
 * - Interactive mouse/touch 3D orbit with damped inertia + auto-orbit
 * - Coupled 0.0T -> 20.0T Dieter Rams Tesla pinch slider wired live to geometry, headline,
 *   rotating <textPath> ring, and <3.0T MHD kink disruption instability
 */
export const Act3Cage: React.FC = () => {
  const [mode, setMode] = useState<CageMode>('tokamak');

  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportWrapRef = useRef<HTMLDivElement | null>(null);
  const headlineRef = useRef<HTMLHeadingElement | null>(null);
  const lineMaskRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const lineInnerRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const ringTextSvgRef = useRef<SVGSVGElement | null>(null);

  // Direct-DOM refs for zero-re-render 60fps Tesla slider & telemetry
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const sliderFillRef = useRef<HTMLDivElement | null>(null);
  const sliderHandleRef = useRef<HTMLDivElement | null>(null);
  const telemetryBannerRef = useRef<HTMLDivElement | null>(null);
  const bFieldReadoutRef = useRef<HTMLSpanElement | null>(null);
  const pressureReadoutRef = useRef<HTMLSpanElement | null>(null);

  // Mutable 60fps engine refs (zero useState in rAF / drag)
  const morphProxyRef = useRef({ t: 0 });
  const targetTeslaRef = useRef<number>(CONTENT.act3.defaultTesla);
  const currentTeslaSpringRef = useRef<SpringState>({
    pos: CONTENT.act3.defaultTesla,
    vel: 0,
  });
  const orbitRef = useRef({
    rotY: 0.42,
    rotX: 0.56,
    velY: 0,
    velX: 0,
    dragging: false,
    lastPtrX: 0,
    lastPtrY: 0,
  });
  const ringAngleDegRef = useRef(0);
  const entranceDoneRef = useRef(false);

  const ringTextPath = useMemo(() => generateCirclePath(300, 300, 266), []);
  const repeatedRingText = `${CONTENT.act3.fieldRingText}${CONTENT.act3.fieldRingText}${CONTENT.act3.fieldRingText}`;

  // Sync mode tab clicks to continuous 1.15s expo.inOut topological morph
  const isFirstModeMountRef = useRef(true);
  useEffect(() => {
    if (isFirstModeMountRef.current) {
      isFirstModeMountRef.current = false;
      return;
    }
    spectralAudio.playTopologyClick(mode);
    const tween = gsap.to(morphProxyRef.current, {
      t: mode === 'stellarator' ? 1 : 0,
      duration: 1.15,
      ease: 'expo.inOut',
      overwrite: true,
    });
    return () => {
      tween.kill();
    };
  }, [mode]);

  // Helper to update target Tesla value & slider DOM visuals synchronously (zero React setState)
  const applySliderDom = (tesla: number) => {
    const clamped = Number(clamp(tesla, 0, 20).toFixed(1));
    targetTeslaRef.current = clamped;
    const pct = (clamped / 20) * 100;
    const isDisrupted = clamped < 3.0;
    const pressureMPa = computeMagneticPressureMPa(clamped);

    if (sliderTrackRef.current) {
      sliderTrackRef.current.setAttribute('aria-valuenow', String(clamped));
      sliderTrackRef.current.setAttribute(
        'aria-valuetext',
        `${clamped.toFixed(1)} Tesla, ${pressureMPa.toFixed(1)} MegaPascals`
      );
    }
    if (sliderFillRef.current) {
      sliderFillRef.current.style.width = `${pct.toFixed(2)}%`;
      sliderFillRef.current.style.backgroundColor = isDisrupted ? '#FF2A2A' : '#EAFF2B';
    }
    if (sliderHandleRef.current) {
      sliderHandleRef.current.style.left = `${pct.toFixed(2)}%`;
      sliderHandleRef.current.style.backgroundColor = isDisrupted ? '#FF2A2A' : '#EAFF2B';
      sliderHandleRef.current.style.borderColor = isDisrupted ? '#F6F3EB' : '#1822FF';
    }
    if (bFieldReadoutRef.current) {
      bFieldReadoutRef.current.textContent = `${clamped.toFixed(1).padStart(4, '0')} T`;
    }
    if (pressureReadoutRef.current) {
      pressureReadoutRef.current.textContent = isDisrupted
        ? CONTENT.act3.disruptionWarning
        : `MAGNETIC PRESSURE: ${pressureMPa.toFixed(1)} MPa`;
    }
    if (telemetryBannerRef.current) {
      if (isDisrupted) {
        telemetryBannerRef.current.style.backgroundColor = '#FF2A2A';
        telemetryBannerRef.current.style.color = '#F6F3EB';
        telemetryBannerRef.current.style.borderColor = '#F6F3EB';
      } else {
        telemetryBannerRef.current.style.backgroundColor = 'transparent';
        telemetryBannerRef.current.style.color = '#F6F3EB';
        telemetryBannerRef.current.style.borderColor = 'rgba(246, 243, 235, 0.5)';
      }
    }
  };

  // Choreographed Act 3 ScrollTrigger entrance (once: true, top 75%)
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    applySliderDom(CONTENT.act3.defaultTesla);

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReducedMotion) {
      entranceDoneRef.current = true;
      return;
    }

    const ctx = gsap.context(() => {
      const masks = lineMaskRefs.current.filter(
        (el): el is HTMLSpanElement => el !== null
      );
      const inners = lineInnerRefs.current.filter(
        (el): el is HTMLSpanElement => el !== null
      );

      gsap.set(masks, { overflow: 'hidden' });
      gsap.set(inners, { yPercent: 115 });
      if (viewportWrapRef.current) {
        gsap.set(viewportWrapRef.current, { scale: 0.85, opacity: 0 });
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 75%',
          once: true,
        },
        onComplete: () => {
          gsap.set(masks, { overflow: 'visible' });
          entranceDoneRef.current = true;
        },
      });

      tl.to(
        inners,
        {
          yPercent: 0,
          duration: 0.86,
          stagger: 0.08,
          ease: 'expo.out',
        },
        0
      );

      if (headlineRef.current) {
        tl.fromTo(
          headlineRef.current,
          { '--cage-wght': 240, '--cage-wdth': 75 } as gsap.TweenVars,
          {
            '--cage-wght': 620,
            '--cage-wdth': 85,
            duration: 0.9,
            ease: 'expo.out',
          } as gsap.TweenVars,
          0
        );
      }

      if (viewportWrapRef.current) {
        tl.to(
          viewportWrapRef.current,
          {
            scale: 1,
            opacity: 1,
            duration: 0.95,
            ease: 'expo.out',
          },
          0.08
        );
      }

      // Subtle living calibration sweep (morphT: 0.35 -> 0) on arrival
      tl.fromTo(
        morphProxyRef.current,
        { t: 0.35 },
        { t: 0, duration: 1.1, ease: 'expo.out' },
        0.12
      );
    }, sectionRef);

    return () => {
      ctx.revert();
    };
  }, []);

  // High-DPI 60fps 3D Parametric Vector Manifold Engine (auto-paused offscreen via IntersectionObserver)
  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    let isVisible = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisible = entry.isIntersecting;
        }
      },
      { threshold: 0.01, rootMargin: '120px 0px 120px 0px' }
    );
    observer.observe(section);

    let cssSize = 520;
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssSize = Math.max(240, Math.round(Math.min(rect.width, rect.height) || rect.width));
      canvas.width = Math.round(cssSize * dpr);
      canvas.height = Math.round(cssSize * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    let rafId = 0;
    let lastTs = performance.now();
    let lastPinchKey = '';

    // Helper: push a 2D line segment into 3 depth buckets (0=back, 1=mid, 2=front)
    type SegList = number[];
    const strokeBucket = (
      segs: SegList,
      strokeStyle: string,
      lineWidth: number
    ) => {
      if (segs.length === 0) return;
      ctx2d.strokeStyle = strokeStyle;
      ctx2d.lineWidth = lineWidth;
      ctx2d.beginPath();
      for (let i = 0; i < segs.length; i += 4) {
        ctx2d.moveTo(segs[i], segs[i + 1]);
        ctx2d.lineTo(segs[i + 2], segs[i + 3]);
      }
      ctx2d.stroke();
    };

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (!isVisible) {
        lastTs = now;
        return;
      }

      const dtMs = Math.min(48, Math.max(4, now - lastTs));
      lastTs = now;
      const dtSec = dtMs * 0.001;
      const dtFactor = dtMs / 16.6667;
      const timeSec = now * 0.001;

      // Smooth spring on Tesla magnetic field strength (snap cleanly at rest)
      const teslaSpring = currentTeslaSpringRef.current;
      stepSpring(teslaSpring, targetTeslaRef.current, 0.16, 0.74, dtFactor);
      if (
        Math.abs(teslaSpring.pos - targetTeslaRef.current) < 0.015 &&
        Math.abs(teslaSpring.vel) < 0.015
      ) {
        teslaSpring.pos = targetTeslaRef.current;
        teslaSpring.vel = 0;
      }
      const bField = clamp(teslaSpring.pos, 0, 20);
      const morphT = clamp(morphProxyRef.current.t, 0, 1);

      // Update coupled headline typography pinch (dirty-checked to avoid idle font rasterization)
      const pinch = computeHeadlinePinch(bField);

      if (headlineRef.current && entranceDoneRef.current) {
        const hs = headlineRef.current.style;
        const pinchKey = `${pinch.wdth.toFixed(1)}|${pinch.wght.toFixed(0)}|${pinch.letterSpacingEm.toFixed(4)}`;
        if (pinchKey !== lastPinchKey) {
          lastPinchKey = pinchKey;
          hs.setProperty('--cage-wdth', String(pinch.wdth));
          hs.setProperty('--cage-wght', String(pinch.wght));
          hs.setProperty('--cage-tracking', `${pinch.letterSpacingEm}em`);
        }

        // High-frequency crisp horizontal glitch-shear when plasma disrupts (< 3.0 T)
        if (pinch.isDisrupted) {
          const jitterX =
            (Math.sin(timeSec * 53) * 0.6 + Math.cos(timeSec * 89) * 0.4) *
            6.5 *
            pinch.disruptionFactor;
          const jitterSkew =
            Math.sin(timeSec * 41) * 4.5 * pinch.disruptionFactor;
          hs.transform = `translate3d(${jitterX.toFixed(1)}px, 0, 0) skewX(${jitterSkew.toFixed(2)}deg)`;
        } else if (hs.transform !== '') {
          hs.transform = '';
        }
      }

      // GPU-composited rotation of outer SVG <textPath> ring (zero SVG text re-rasterization)
      ringAngleDegRef.current =
        (ringAngleDegRef.current + ((pinch.ringAngularSpeedRad * 180) / Math.PI) * dtSec) %
        360;
      if (ringTextSvgRef.current) {
        ringTextSvgRef.current.style.transform = `rotate(${ringAngleDegRef.current.toFixed(2)}deg)`;
      }

      // Update 3D orbit inertia + slow gyroscopic auto-orbit when untouched
      const orb = orbitRef.current;
      if (!orb.dragging) {
        orb.velY *= Math.pow(0.92, dtFactor);
        orb.velX *= Math.pow(0.92, dtFactor);
        orb.rotY += orb.velY + (0.22 + (bField / 20) * 0.14) * dtSec;
        orb.rotX = clamp(orb.rotX + orb.velX, -1.25, 1.25);
      }

      // === RENDER HIGH-DPI 3D PARAMETRIC MANIFOLD (BATCHED DEPTH-SHADED STROKES) ===
      ctx2d.clearRect(0, 0, cssSize, cssSize);

      const cx = cssSize * 0.5;
      const cy = cssSize * 0.5;
      const scale = cssSize * 0.185;
      const params: CagePhysicsParams = {
        morphT,
        bFieldTesla: bField,
        timeSec,
      };

      const project = (p: { x: number; y: number; z: number }) =>
        projectPoint3D(p, orb.rotY, orb.rotX, scale, cx, cy, 6.4);

      // 1. 18 Superconducting Field Coils (batched into 2 depth passes)
      const coilCount = 18;
      const coilSteps = 26;
      const coilBack: SegList = [];
      const coilFront: SegList = [];
      for (let c = 0; c < coilCount; c++) {
        const midProj = project(evaluateModularCoilPoint(c, coilCount, 0, params));
        const bucket = midProj.depth > 0 ? coilFront : coilBack;
        let prev = project(evaluateModularCoilPoint(c, coilCount, 0, params));
        for (let s = 1; s <= coilSteps; s++) {
          const theta = (s / coilSteps) * Math.PI * 2;
          const curr = project(evaluateModularCoilPoint(c, coilCount, theta, params));
          bucket.push(prev.sx, prev.sy, curr.sx, curr.sy);
          prev = curr;
        }
      }
      strokeBucket(coilBack, 'rgba(246, 243, 235, 0.18)', 0.85);
      strokeBucket(coilFront, 'rgba(246, 243, 235, 0.48)', 1.2);

      // 2. Nested Inner Core Flux Rings (batched into 2 depth passes)
      const innerBack: SegList = [];
      const innerFront: SegList = [];
      const innerParams: CagePhysicsParams = { ...params, radialScale: 0.56 };
      for (let k = 0; k < 10; k++) {
        const phi = (k / 10) * Math.PI * 2;
        const centerProj = project(evaluateMagneticAxisPoint(phi, params));
        const bucket = centerProj.depth > 0 ? innerFront : innerBack;
        let prev = project(evaluatePlasmaSurfacePoint(phi, 0, innerParams));
        for (let s = 1; s <= 22; s++) {
          const theta = (s / 22) * Math.PI * 2;
          const curr = project(evaluatePlasmaSurfacePoint(phi, theta, innerParams));
          bucket.push(prev.sx, prev.sy, curr.sx, curr.sy);
          prev = curr;
        }
      }
      strokeBucket(innerBack, 'rgba(0, 216, 255, 0.16)', 0.85);
      strokeBucket(innerFront, 'rgba(0, 216, 255, 0.38)', 1.0);

      // 3. Helical Magnetic Field Lines winding around the 3D surface (safety factor q = 3.1)
      const safetyFactorQ = 3.1 + (bField / 20) * 0.65;
      const fieldLineCount = 8;
      const phiSteps = 96;

      const yellowBands: [SegList, SegList, SegList] = [[], [], []];
      const cyanBands: [SegList, SegList, SegList] = [[], [], []];
      const redBands: [SegList, SegList, SegList] = [[], [], []];

      for (let f = 0; f < fieldLineCount; f++) {
        const thetaOffset = (f / fieldLineCount) * Math.PI * 2;
        const targetBands =
          pinch.isDisrupted && f % 3 === 0
            ? redBands
            : f % 2 === 1
              ? cyanBands
              : yellowBands;

        let prev = project(evaluatePlasmaSurfacePoint(0, thetaOffset, params));
        for (let s = 1; s <= phiSteps; s++) {
          const phi = (s / phiSteps) * Math.PI * 2;
          const theta = phi * safetyFactorQ + thetaOffset;
          const curr = project(evaluatePlasmaSurfacePoint(phi, theta, params));
          const a = (prev.alpha + curr.alpha) * 0.5;
          const band = a < 0.36 ? 0 : a < 0.66 ? 1 : 2;
          targetBands[band].push(prev.sx, prev.sy, curr.sx, curr.sy);
          prev = curr;
        }
      }

      strokeBucket(cyanBands[0], 'rgba(0, 216, 255, 0.18)', 0.85);
      strokeBucket(cyanBands[1], 'rgba(0, 216, 255, 0.48)', 1.15);
      strokeBucket(cyanBands[2], 'rgba(0, 216, 255, 0.88)', 1.65);

      strokeBucket(yellowBands[0], 'rgba(234, 255, 43, 0.18)', 0.85);
      strokeBucket(yellowBands[1], 'rgba(234, 255, 43, 0.50)', 1.15);
      strokeBucket(yellowBands[2], 'rgba(234, 255, 43, 0.92)', 1.65);

      if (pinch.isDisrupted) {
        strokeBucket(redBands[0], 'rgba(255, 42, 42, 0.28)', 1.0);
        strokeBucket(redBands[1], 'rgba(255, 42, 42, 0.62)', 1.4);
        strokeBucket(redBands[2], 'rgba(255, 42, 42, 0.96)', 2.0);
      }

      // 4. Stellarator 5 Distinct Edge Magnetic Island Chains (fade in smoothly with morphT)
      if (morphT > 0.04) {
        const islCyanBack: SegList = [];
        const islCyanFront: SegList = [];
        const islYelBack: SegList = [];
        const islYelFront: SegList = [];

        const islandSteps = 56;
        for (let isl = 0; isl < 5; isl++) {
          const isCyan = isl % 2 === 0;
          let prev = project(evaluateMagneticIslandPoint(isl, 0, 0, params));
          for (let s = 1; s <= islandSteps; s++) {
            const phi = (s / islandSteps) * Math.PI * 2;
            const localA = phi * 5 + isl;
            const curr = project(evaluateMagneticIslandPoint(isl, phi, localA, params));
            const front = (prev.alpha + curr.alpha) * 0.5 > 0.52;
            const bucket = isCyan
              ? front
                ? islCyanFront
                : islCyanBack
              : front
                ? islYelFront
                : islYelBack;
            bucket.push(prev.sx, prev.sy, curr.sx, curr.sy);
            prev = curr;
          }
        }
        strokeBucket(islCyanBack, `rgba(0, 216, 255, ${(0.28 * morphT).toFixed(3)})`, 1.05);
        strokeBucket(islCyanFront, `rgba(0, 216, 255, ${(0.92 * morphT).toFixed(3)})`, 1.9);
        strokeBucket(islYelBack, `rgba(234, 255, 43, ${(0.28 * morphT).toFixed(3)})`, 1.05);
        strokeBucket(islYelFront, `rgba(234, 255, 43, ${(0.94 * morphT).toFixed(3)})`, 1.9);
      }

      // 5. Hot #FF1F71 Magnetic Axis Core Filament (flashes #FF2A2A crimson during kink disruption)
      const axisSteps = 72;
      const axisBack: SegList = [];
      const axisFront: SegList = [];
      let prevAxis = project(evaluateMagneticAxisPoint(0, params));
      for (let s = 1; s <= axisSteps; s++) {
        const phi = (s / axisSteps) * Math.PI * 2;
        const currAxis = project(evaluateMagneticAxisPoint(phi, params));
        const bucket = (prevAxis.alpha + currAxis.alpha) * 0.5 > 0.5 ? axisFront : axisBack;
        bucket.push(prevAxis.sx, prevAxis.sy, currAxis.sx, currAxis.sy);
        prevAxis = currAxis;
      }
      const axisRgb = pinch.isDisrupted ? '255, 42, 42' : '255, 31, 113';
      strokeBucket(axisBack, `rgba(${axisRgb}, 0.45)`, pinch.isDisrupted ? 2.2 : 1.7);
      strokeBucket(axisFront, `rgba(${axisRgb}, 0.98)`, pinch.isDisrupted ? 3.2 : 2.5);

      // 6. Live Relativistic Plasma Tracer Pulses (crisp high-speed segmented vector arcs)
      const tracerCount = 18;
      const tracerSpeed = 0.65 + (bField / 20) * 2.15;
      const arcSpanPhi = 0.24;
      const arcSubSteps = 5;
      const tracerWhite: SegList = [];
      const tracerYellow: SegList = [];
      const tracerRed: SegList = [];

      for (let tr = 0; tr < tracerCount; tr++) {
        const lineIdx = tr % fieldLineCount;
        const thetaOffset = (lineIdx / fieldLineCount) * Math.PI * 2;
        const headPhi =
          (timeSec * tracerSpeed + (tr / tracerCount) * Math.PI * 2) %
          (Math.PI * 2);

        const bucket = pinch.isDisrupted
          ? tracerRed
          : tr % 3 === 0
            ? tracerWhite
            : tracerYellow;

        let prev = project(
          evaluatePlasmaSurfacePoint(headPhi, headPhi * safetyFactorQ + thetaOffset, params)
        );
        for (let j = 1; j <= arcSubSteps; j++) {
          const phi = headPhi - (j / arcSubSteps) * arcSpanPhi;
          const theta = phi * safetyFactorQ + thetaOffset;
          const curr = project(evaluatePlasmaSurfacePoint(phi, theta, params));
          bucket.push(prev.sx, prev.sy, curr.sx, curr.sy);
          prev = curr;
        }
      }
      strokeBucket(tracerYellow, 'rgba(234, 255, 43, 0.95)', 2.4);
      strokeBucket(tracerWhite, 'rgba(246, 243, 235, 0.96)', 2.5);
      if (pinch.isDisrupted) {
        strokeBucket(tracerRed, 'rgba(255, 42, 42, 0.98)', 2.8);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
      observer.disconnect();
    };
  }, []);

  // Interactive 3D Orbit Pointer/Touch Handlers on the Reactor Canvas
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const orb = orbitRef.current;
    orb.dragging = true;
    orb.lastPtrX = e.clientX;
    orb.lastPtrY = e.clientY;
    orb.velX = 0;
    orb.velY = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const orb = orbitRef.current;
    if (!orb.dragging) return;
    const dx = e.clientX - orb.lastPtrX;
    const dy = e.clientY - orb.lastPtrY;
    orb.lastPtrX = e.clientX;
    orb.lastPtrY = e.clientY;

    const dRotY = dx * 0.0085;
    const dRotX = dy * 0.0075;
    orb.rotY += dRotY;
    orb.rotX = clamp(orb.rotX + dRotX, -1.25, 1.25);
    orb.velY = dRotY;
    orb.velX = dRotX;
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    orbitRef.current.dragging = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Tactile Tesla Instrument Slider Drag & Keyboard Control (zero useState)
  const updateTeslaFromClientX = (clientX: number) => {
    const track = sliderTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const tesla = Math.round(ratio * 200) / 10; // 0.1 T precision
    applySliderDom(tesla);
    spectralAudio.playMagneticStep(tesla, tesla < 3.0);
  };

  const handleSliderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateTeslaFromClientX(e.clientX);
  };

  const handleSliderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updateTeslaFromClientX(e.clientX);
  };

  const handleSliderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 2.0 : 0.5;
    const cur = targetTeslaRef.current;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      applySliderDom(cur + step);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      applySliderDom(cur - step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      applySliderDom(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      applySliderDom(20);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="act-3"
      data-act="3"
      data-act-ink="light"
      data-cage-mode={mode}
      className="relative min-h-[100svh] w-full bg-[#1822FF] text-[#F6F3EB] flex flex-col justify-between px-4 sm:px-6 md:px-10 pt-[3.5rem] pb-[3rem] border-b border-[#111114] overflow-hidden box-border"
    >
      {/* Top Eyebrow Strip */}
      <div className="relative z-10 w-full border-t border-[rgba(246,243,235,0.28)] pt-2">
        <p className="font-mono-lab text-[10px] sm:text-xs tracking-[0.08em] text-[#F6F3EB]">
          {CONTENT.act3.eyebrow}
        </p>
      </div>

      {/* Simultaneous 2-Column Swiss Split (>= 680px: 0.92fr Controls + 1.08fr 3D Manifold) */}
      <div
        className="relative z-10 my-auto py-3 sm:py-4 act3-split-grid"
        data-testid="act3-split-grid"
      >
        {/* Column 1: Acid Tungsten Headline + Topology Tabs + Dieter Rams Tesla Field Instrument */}
        <div className="flex flex-col gap-3.5 sm:gap-5 min-w-0">
          <h2
            ref={headlineRef}
            className="cage-headline k-font-bricolage uppercase text-[#EAFF2B] doppler-heading doppler-shear"
            data-testid="act3-headline"
          >
            {CONTENT.act3.headlineLines.map((line, idx) => (
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
                  className="block"
                >
                  <KineticText
                    text={line}
                    font="bricolage"
                    charStartIndex={idx * 16}
                  />
                </span>
              </span>
            ))}
          </h2>

          {/* Square-Cornered Hairline Topology Toggle */}
          <div
            className="grid grid-cols-1 xl:grid-cols-2 w-full border border-[#F6F3EB] arch-surface"
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
                  className={`font-mono-lab text-[10px] sm:text-[11px] font-semibold tracking-[0.04em] px-2.5 sm:px-3 py-2 min-h-[34px] sm:min-h-[38px] arch-surface whitespace-nowrap truncate cursor-pointer border-b xl:border-b-0 xl:border-r last:border-b-0 last:border-r-0 border-[#F6F3EB] ${
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

          {/* Dieter Rams Horizontal Tesla Field Pinch Instrument (0.0 T -> 20.0 T) */}
          <div className="w-full flex flex-col gap-2">
            {/* Live Tabular B-Field & Magnetic Pressure / Disruption Readout */}
            <div
              ref={telemetryBannerRef}
              className="w-full border px-2.5 py-1.5 arch-surface font-mono-lab text-[10px] sm:text-[11px] tracking-[0.05em] flex flex-wrap items-center justify-between gap-1.5"
              style={{ borderColor: 'rgba(246, 243, 235, 0.5)' }}
              data-testid="tesla-telemetry-banner"
            >
              <span className="font-bold whitespace-nowrap">
                B-FIELD: <span ref={bFieldReadoutRef}>12.0 T</span>
              </span>
              <span
                ref={pressureReadoutRef}
                className="font-semibold tracking-[0.04em]"
                data-testid="tesla-pressure-readout"
              >
                MAGNETIC PRESSURE: 57.3 MPa
              </span>
            </div>

            {/* Precision 20-Notch Interactive Slider Track */}
            <div
              ref={sliderTrackRef}
              role="slider"
              tabIndex={0}
              aria-label="Magnetic Field Strength in Tesla"
              aria-valuemin={0}
              aria-valuemax={20}
              aria-valuenow={CONTENT.act3.defaultTesla}
              data-testid="tesla-slider"
              data-interactive="true"
              onPointerDown={handleSliderPointerDown}
              onPointerMove={handleSliderPointerMove}
              onPointerUp={handleSliderPointerUp}
              onPointerCancel={handleSliderPointerUp}
              onKeyDown={handleSliderKeyDown}
              className="relative w-full h-9 sm:h-10 border border-[#F6F3EB] arch-surface cursor-ew-resize select-none touch-none flex items-center"
            >
              {/* Active Fill Bar */}
              <div
                ref={sliderFillRef}
                className="pointer-events-none absolute inset-y-0 left-0 bg-[#EAFF2B]/25 arch-surface"
                style={{ width: '60%', opacity: 0.28 }}
              />

              {/* 20 Precision Calibrated Tick Notches */}
              <div
                className="pointer-events-none absolute inset-0 flex justify-between px-0"
                aria-hidden="true"
              >
                {Array.from({ length: 21 }).map((_, idx) => (
                  <span
                    key={`t-${idx}`}
                    className="block w-px self-end"
                    style={{
                      height: idx % 5 === 0 ? '48%' : '26%',
                      backgroundColor:
                        idx < 3
                          ? '#FF2A2A'
                          : idx % 5 === 0
                            ? 'rgba(246, 243, 235, 0.78)'
                            : 'rgba(246, 243, 235, 0.32)',
                    }}
                  />
                ))}
              </div>

              {/* Tactile Square Handle */}
              <div
                ref={sliderHandleRef}
                className="pointer-events-none absolute top-0 bottom-0 w-3.5 -translate-x-1/2 bg-[#EAFF2B] border-2 border-[#1822FF] arch-surface"
                style={{ left: '60%' }}
              />
            </div>

            {/* Precision-Aligned Scale Bounds (0%, 15%, 60%, 100% locked directly to tick notches) */}
            <div className="relative h-3.5 w-full font-mono-lab text-[9.5px] tracking-[0.08em] text-[#F6F3EB]/80">
              <span className="absolute left-0">0.0 T</span>
              <span className="hidden lg:inline absolute left-[15%] -translate-x-1/2 text-[#FF6B6B]">
                3.0 T
              </span>
              <span className="absolute left-[60%] -translate-x-1/2">12.0 T</span>
              <span className="absolute right-0">20.0 T</span>
            </div>
          </div>
        </div>

        {/* Column 2: Commanding 3D-Projected Parametric Vector Manifold + Rotating SVG Ring */}
        <div
          ref={viewportWrapRef}
          className="flex items-center justify-center min-w-0"
        >
          <div
            className="relative aspect-square flex items-center justify-center"
            style={{ width: 'min(100%, 560px, 68svh)' }}
          >
            {/* Static Architectural Aperture Rings & Crosshairs */}
            <svg
              viewBox="0 0 600 600"
              className="pointer-events-none absolute inset-0 w-full h-full"
              aria-hidden="true"
            >
              <circle
                cx="300"
                cy="300"
                r="288"
                fill="none"
                stroke="#F6F3EB"
                strokeOpacity="0.24"
                strokeWidth="1"
              />
              <circle
                cx="300"
                cy="300"
                r="242"
                fill="none"
                stroke="#F6F3EB"
                strokeOpacity="0.22"
                strokeWidth="1"
              />
              <line
                x1="300"
                y1="10"
                x2="300"
                y2="590"
                stroke="#F6F3EB"
                strokeOpacity="0.14"
                strokeWidth="1"
              />
              <line
                x1="10"
                y1="300"
                x2="590"
                y2="300"
                stroke="#F6F3EB"
                strokeOpacity="0.14"
                strokeWidth="1"
              />
            </svg>

            {/* GPU-Composited Rotating SVG <textPath> Outer Telemetry Ring */}
            <svg
              ref={ringTextSvgRef}
              viewBox="0 0 600 600"
              className="pointer-events-none absolute inset-0 w-full h-full"
              style={{ transformOrigin: '50% 50%' }}
              aria-hidden="true"
            >
              <defs>
                <path id="cage-field-ring-path" d={ringTextPath} />
              </defs>
              <text
                fill="#F6F3EB"
                fontSize="10.4"
                letterSpacing="2.85"
                className="font-mono-lab"
              >
                <textPath href="#cage-field-ring-path" startOffset="0%">
                  {repeatedRingText}
                </textPath>
              </text>
            </svg>

            {/* High-DPI Interactive 3D Parametric Vector Manifold Canvas */}
            <canvas
              ref={canvasRef}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
              data-testid="act3-manifold-canvas"
              data-interactive="true"
              aria-label={
                mode === 'tokamak'
                  ? 'Interactive 3D Tokamak symmetric toroidal magnetic confinement manifold'
                  : 'Interactive 3D Wendelstein 7-X 5-fold twisted Stellarator helical manifold with edge magnetic islands'
              }
              className="relative z-10 w-[82%] h-[82%] cursor-crosshair active:cursor-grabbing touch-none"
            />
          </div>
        </div>
      </div>

      {/* Bottom ΔT Telemetry Strip */}
      <div className="relative z-10 w-full border-t border-[rgba(246,243,235,0.45)] pt-2.5">
        <p className="font-mono-lab text-[10px] sm:text-xs tracking-[0.06em] text-[#F6F3EB]">
          {CONTENT.act3.telemetryStrip}
        </p>
      </div>
    </section>
  );
};
