/**
 * Zero-asset procedural Web Audio API synthesizer for "656.3nm".
 * - 100% synthesized oscillators & filtered impulses (zero external files, zero network calls)
 * - MUTED BY DEFAULT until explicitly toggled ON by user gesture
 * - Master gain capped (~0.18) with soft DynamicsCompressor & click-free envelopes
 * - Automatically suspends AudioContext when muted or browser tab is hidden
 */

type AudioListener = (enabled: boolean, level: number) => void;

const WORDMARK_SCALE_HZ = [329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99] as const;

class SpectralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = false;
  private listeners = new Set<AudioListener>();
  private meterLevel = 0;
  private meterDecayTimer: number | null = null;
  private lastDetentTs = 0;
  private lastMagneticTs = 0;
  private lastTensionTs = 0;
  private visibilityBound = false;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public subscribe(listener: AudioListener): () => void {
    this.listeners.add(listener);
    listener(this.enabled, this.meterLevel);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.enabled, this.meterLevel);
    }
  }

  private bumpMeter(intensity: number): void {
    if (!this.enabled) return;
    this.meterLevel = Math.min(1, Math.max(this.meterLevel, intensity));
    this.emit();
    if (typeof window !== 'undefined') {
      if (this.meterDecayTimer !== null) {
        window.clearTimeout(this.meterDecayTimer);
      }
      this.meterDecayTimer = window.setTimeout(() => {
        this.meterLevel = 0.14;
        this.emit();
      }, 220);
    }
  }

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.visibilityState === 'hidden') {
        void this.ctx.suspend().catch(() => {});
      } else if (this.enabled && this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
    });
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtor) return null;

      const ctx = new AudioCtor();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.12;

      const master = ctx.createGain();
      master.gain.value = 0.18;

      master.connect(compressor);
      compressor.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = master;
      this.bindVisibility();
    }
    return this.ctx;
  }

  public setEnabled(next: boolean): boolean {
    this.enabled = next;
    if (next) {
      const ctx = this.ensureContext();
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      this.meterLevel = 0.25;
      this.emit();
      // Subtle 14ms confirmation click on enable
      this.playTick(1320, 0.014, 0.22);
    } else {
      this.meterLevel = 0;
      if (this.ctx && this.ctx.state === 'running') {
        void this.ctx.suspend().catch(() => {});
      }
      this.emit();
    }
    return this.enabled;
  }

  public toggle(): boolean {
    return this.setEnabled(!this.enabled);
  }

  private ready(): { ctx: AudioContext; out: GainNode; now: number } | null {
    if (!this.enabled || !this.ctx || !this.masterGain) return null;
    if (this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => {});
    }
    return { ctx: this.ctx, out: this.masterGain, now: this.ctx.currentTime };
  }

  private playTick(freqHz: number, durationSec: number, gainPeak: number): void {
    const r = this.ready();
    if (!r) return;
    const { ctx, out, now } = r;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freqHz, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(120, freqHz * 0.45), now + durationSec);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.0018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + durationSec + 0.01);
  }

  /** Act 0: Rising 16kFPS shutter calibration sweep */
  public playShutterSweep(): void {
    const r = this.ready();
    if (!r) return;
    const { ctx, out, now } = r;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(1440, now + 0.92);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.Q.value = 2.4;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.96);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 1.0);
    this.bumpMeter(0.65);
  }

  /** Act 0: 12ms analog optical shutter lock click at 16000 FPS */
  public playShutterLock(): void {
    this.playTick(2200, 0.014, 0.42);
    this.bumpMeter(0.85);
  }

  /** Act 2: Glass-sine spectral chime tuned to inverse-wavelength ratio (656/nm) */
  public playIonizationChime(wavelengthNm: number): void {
    const r = this.ready();
    if (!r) return;
    const { ctx, out, now } = r;

    const ratio = 656.28 / Math.max(400, wavelengthNm);
    const baseHz = 440 * ratio;

    [1, 2.003].forEach((mult, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseHz * mult, now);

      const peak = idx === 0 ? 0.28 : 0.1;
      const dur = idx === 0 ? 0.58 : 0.34;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    });

    this.bumpMeter(0.72);
  }

  /** Act 3: Crisp mechanical switch click when morphing Tokamak <-> Stellarator */
  public playTopologyClick(mode: 'tokamak' | 'stellarator'): void {
    this.playTick(mode === 'stellarator' ? 1480 : 1080, 0.018, 0.34);
    this.bumpMeter(0.55);
  }

  /** Act 3: Subtle filtered magnetic harmonic pulse while adjusting B-FIELD slider */
  public playMagneticStep(tesla: number, isDisrupted: boolean): void {
    const perfNow = performance.now();
    if (perfNow - this.lastMagneticTs < 65) return;
    this.lastMagneticTs = perfNow;

    const r = this.ready();
    if (!r) return;
    const { ctx, out, now } = r;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    if (isDisrupted) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(92, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.26, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    } else {
      osc.type = 'sine';
      const pitch = 180 + (tesla / 20) * 440;
      osc.frequency.setValueAtTime(pitch, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(pitch * 2.2, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.13);
    this.bumpMeter(isDisrupted ? 0.65 : 0.38);
  }

  /** Act 4: Crisp 10ms Dieter Rams mechanical rotary detent tick at each 6° mark */
  public playDialDetentTick(dialIdx: number): void {
    const perfNow = performance.now();
    if (perfNow - this.lastDetentTs < 24) return;
    this.lastDetentTs = perfNow;

    const baseFreqs = [1520, 1760, 1340];
    this.playTick(baseFreqs[dialIdx % baseFreqs.length], 0.01, 0.24);
    this.bumpMeter(0.35);
  }

  /** Act 4: Subtle rising fifth harmonic tension above Q = 0.70 */
  public pulseIgnitionTension(qGain: number): void {
    if (qGain < 0.7 || qGain >= 1.0) return;
    const perfNow = performance.now();
    if (perfNow - this.lastTensionTs < 140) return;
    this.lastTensionTs = perfNow;

    const r = this.ready();
    if (!r) return;
    const { ctx, out, now } = r;

    const t = Math.min(1, (qGain - 0.7) / 0.3);
    const root = 220 + t * 110;
    [root, root * 1.5].forEach((hz) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.075 * (0.4 + t * 0.6), now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.18);
    });
    this.bumpMeter(0.45 + t * 0.3);
  }

  /** Act 4 Climax: Luminous crystalline chord + clean sub-thump on X-ray Breakeven Flash */
  public playIgnitionXRayChord(): void {
    const r = this.ready();
    if (!r) return;
    const { ctx, out, now } = r;

    // Clean deep sub-thump (110Hz -> 44Hz)
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(118, now);
    sub.frequency.exponentialRampToValueAtTime(42, now + 0.42);
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.55, now + 0.01);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);
    sub.connect(subGain);
    subGain.connect(out);
    sub.start(now);
    sub.stop(now + 0.72);

    // Luminous crystalline Lydian harmonic stack (D-A-E-F#-B)
    const chordHz = [293.66, 440.0, 659.25, 739.99, 987.77];
    chordHz.forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz, now);

      const peak = 0.2 / (1 + idx * 0.25);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 1.4);
    });

    this.bumpMeter(1.0);
  }

  /** Act 4: Soft downward quench tone when dropping below Q = 1.00 */
  public playQuenchCool(): void {
    const r = this.ready();
    if (!r) return;
    const { ctx, out, now } = r;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(196, now + 0.28);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.35);
    this.bumpMeter(0.45);
  }

  /** Act 5: Delicate harmonic marimba/sine ping across 7-note spectral scale */
  public playWordmarkPing(charIdx: number, intensity = 0.8): void {
    const r = this.ready();
    if (!r) return;
    const { ctx, out, now } = r;

    const hz = WORDMARK_SCALE_HZ[charIdx % WORDMARK_SCALE_HZ.length];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, now);

    const peak = Math.min(0.28, 0.16 * intensity);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.38);
    this.bumpMeter(0.4 + intensity * 0.35);
  }
}

export const spectralAudio = new SpectralAudioEngine();
