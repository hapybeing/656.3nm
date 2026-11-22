import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { clamp, computeDopplerVars } from '../physics/motionMath';

gsap.registerPlugin(ScrollTrigger);

export interface MotionFrameSnapshot {
  timeSec: number;
  dtMs: number;
  scrollY: number;
  scrollProgress: number;
  rawVelocity: number;
  smoothVelocity: number;
  pointerX: number;
  pointerY: number;
  pointerActive: boolean;
  lastInputTimeSec: number;
  reducedMotion: boolean;
}

type FrameListener = (frame: MotionFrameSnapshot) => void;

class MotionEngine {
  private lenis: Lenis | null = null;
  private tickerCallback: ((time: number, deltaTime: number) => void) | null = null;
  private listeners = new Set<FrameListener>();
  private initialized = false;
  private scrollLocked = false;

  // Mutable 60fps state (zero React setState)
  public timeSec = 0;
  public scrollY = 0;
  public scrollProgress = 0;
  public rawVelocity = 0;
  public smoothVelocity = 0;
  public pointerX = -9999;
  public pointerY = -9999;
  public pointerActive = false;
  public lastInputTimeSec = -10;
  public reducedMotion = false;

  private prevScrollY = 0;
  private lastDopplerSlnt = 0;
  private lastDopplerChroma = 0;

  private handlePointerMove = (e: PointerEvent) => {
    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
    this.pointerActive = true;
    this.lastInputTimeSec = this.timeSec;
  };

  private handlePointerLeave = () => {
    this.pointerActive = false;
  };

  private handleTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    this.pointerX = t.clientX;
    this.pointerY = t.clientY;
    this.pointerActive = true;
    this.lastInputTimeSec = this.timeSec;
  };

  private handleTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    this.pointerX = t.clientX;
    this.pointerY = t.clientY;
    this.pointerActive = true;
    this.lastInputTimeSec = this.timeSec;
  };

  private handleTouchEnd = () => {
    this.pointerActive = false;
  };

  public init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.prevScrollY = window.scrollY || 0;
    this.scrollY = this.prevScrollY;

    if (!this.reducedMotion) {
      this.lenis = new Lenis({
        lerp: 0.1,
        smoothWheel: true,
        touchMultiplier: 1.4,
      });

      this.lenis.on('scroll', () => {
        ScrollTrigger.update();
      });

      if (this.scrollLocked) {
        this.lenis.stop();
      }
    }

    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', this.handlePointerMove, { passive: true });
    document.addEventListener('pointerleave', this.handlePointerLeave, { passive: true });
    window.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    window.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    window.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.handleTouchEnd, { passive: true });

    gsap.ticker.lagSmoothing(0);

    this.tickerCallback = (time: number, deltaTime: number) => {
      const dtMs = clamp(deltaTime || 16.6667, 4, 50);
      this.timeSec = time;

      if (this.lenis) {
        this.lenis.raf(time * 1000);
      }

      const currentScroll = this.lenis ? this.lenis.scroll : window.scrollY;
      this.scrollY = currentScroll;

      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      this.scrollProgress = clamp(currentScroll / maxScroll, 0, 1);

      // Compute raw velocity from Lenis or native scroll delta
      if (this.lenis && typeof this.lenis.velocity === 'number') {
        this.rawVelocity = this.lenis.velocity;
      } else {
        this.rawVelocity = ((currentScroll - this.prevScrollY) / dtMs) * 16.6667;
      }
      this.prevScrollY = currentScroll;

      // Exact required velocity smoothing: smoothVel += (rawVel - smoothVel) * 0.14
      this.smoothVelocity += (this.rawVelocity - this.smoothVelocity) * 0.14;
      if (Math.abs(this.smoothVelocity) < 0.015 && Math.abs(this.rawVelocity) < 0.015) {
        this.smoothVelocity = 0;
      }

      // Write Doppler CSS variables to :root only when values change
      const doppler = this.reducedMotion
        ? { slnt: 0, chromaPx: 0 }
        : computeDopplerVars(this.smoothVelocity);

      if (
        doppler.slnt !== this.lastDopplerSlnt ||
        doppler.chromaPx !== this.lastDopplerChroma
      ) {
        this.lastDopplerSlnt = doppler.slnt;
        this.lastDopplerChroma = doppler.chromaPx;
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('--doppler-slnt', String(doppler.slnt));
        rootStyle.setProperty('--doppler-chroma', `${doppler.chromaPx}px`);
      }

      if (this.listeners.size > 0) {
        const snapshot: MotionFrameSnapshot = {
          timeSec: this.timeSec,
          dtMs,
          scrollY: this.scrollY,
          scrollProgress: this.scrollProgress,
          rawVelocity: this.rawVelocity,
          smoothVelocity: this.smoothVelocity,
          pointerX: this.pointerX,
          pointerY: this.pointerY,
          pointerActive: this.pointerActive,
          lastInputTimeSec: this.lastInputTimeSec,
          reducedMotion: this.reducedMotion,
        };
        for (const listener of this.listeners) {
          listener(snapshot);
        }
      }
    };

    gsap.ticker.add(this.tickerCallback);
  }

  public destroy(): void {
    if (!this.initialized) return;
    this.initialized = false;

    if (this.tickerCallback) {
      gsap.ticker.remove(this.tickerCallback);
      this.tickerCallback = null;
    }

    if (this.lenis) {
      this.lenis.destroy();
      this.lenis = null;
    }

    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerdown', this.handlePointerMove);
    document.removeEventListener('pointerleave', this.handlePointerLeave);
    window.removeEventListener('touchstart', this.handleTouchStart);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('touchcancel', this.handleTouchEnd);

    document.documentElement.style.setProperty('--doppler-slnt', '0');
    document.documentElement.style.setProperty('--doppler-chroma', '0px');
    this.lastDopplerSlnt = 0;
    this.lastDopplerChroma = 0;
  }

  public stopScroll(): void {
    this.scrollLocked = true;
    this.lenis?.stop();
  }

  public startScroll(): void {
    this.scrollLocked = false;
    this.lenis?.start();
  }

  public scrollTo(target: string | number | HTMLElement): void {
    if (this.lenis) {
      this.lenis.scrollTo(target, {
        duration: 1.15,
        easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)), // expo.out
      });
      return;
    }
    if (typeof target === 'string') {
      const el = document.querySelector(target);
      el?.scrollIntoView({ behavior: this.reducedMotion ? 'auto' : 'smooth' });
    } else if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior: this.reducedMotion ? 'auto' : 'smooth' });
    } else {
      target.scrollIntoView({ behavior: this.reducedMotion ? 'auto' : 'smooth' });
    }
  }

  public subscribeFrame(listener: FrameListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const motionEngine = new MotionEngine();
