export interface SpectralStage {
  id: 'h-alpha' | 'li-1' | 'li-2' | 'h-beta';
  code: string;
  wavelength: string;
  tabLabel: string;
  nm: number;
  transition: string;
  energy: string;
  title: string;
  bg: string;
  ink: '#111114' | '#F6F3EB';
}

export interface LawsonDialSpec {
  id: 'density' | 'temperature' | 'confinement';
  symbol: string;
  label: string;
  value: string;
  unit: string;
  accent: string;
  progress: number;
}

export type CageMode = 'tokamak' | 'stellarator';

export const CONTENT = {
  brand: '656.3nm',
  chrome: {
    topTelemetry: 'λ 656.28nm  //  16,000 FPS  //  ST40-OPTICAL',
    coordsPlaceholder: 'X: 0000 / Y: 0000',
    spectralBarColors: ['#FF1F71', '#FF2A2A', '#00E676', '#00D8FF'] as const,
  },
  act1: {
    eyebrow: 'ACT 01  //  CORE: 150,000,000 K  //  VISIBLE LIGHT: 0.00%',
    headlineLines: ['150 MILLION', 'DEGREES IS', 'INVISIBLE.'] as const,
    captionLeft: 'THE CORE IS TOO HOT TO GLOW. ONLY THE EDGE BURNS.',
    scrollCue: 'SCROLL ↓  656.28nm',
  },
  act2: {
    eyebrow: 'ACT 02  //  LITHIUM PELLET INJECTION  //  SPECTRAL SNAP',
    spectrometerBounds: {
      minLabel: '410nm',
      maxLabel: '671nm',
      minNm: 410,
      maxNm: 671,
    },
    stages: [
      {
        id: 'h-alpha',
        code: 'H-ALPHA',
        wavelength: '656.28 nm',
        tabLabel: '656.28nm',
        nm: 656.28,
        transition: 'n = 3 → 2',
        energy: '1.89 eV',
        title: 'DEUTERIUM EDGE',
        bg: '#FF1F71',
        ink: '#111114',
      },
      {
        id: 'li-1',
        code: 'Li I',
        wavelength: '670.78 nm',
        tabLabel: '670.78nm',
        nm: 670.78,
        transition: 'NEUTRAL FLASH',
        energy: '1.85 eV',
        title: 'LITHIUM IMPACT',
        bg: '#FF2A2A',
        ink: '#F6F3EB',
      },
      {
        id: 'li-2',
        code: 'Li II',
        wavelength: '548.50 nm',
        tabLabel: '548.50nm',
        nm: 548.5,
        transition: 'ELECTRON STRIPPED',
        energy: '5.39 eV',
        title: 'IONIZED EMERALD',
        bg: '#00E676',
        ink: '#111114',
      },
      {
        id: 'h-beta',
        code: 'H-BETA',
        wavelength: '486.14 nm',
        tabLabel: '486.14nm',
        nm: 486.14,
        transition: 'n = 4 → 2',
        energy: '2.55 eV',
        title: 'THERMAL EQUILIBRIUM',
        bg: '#00D8FF',
        ink: '#111114',
      },
    ] as readonly SpectralStage[],
  },
  act3: {
    eyebrow: 'ACT 03  //  CONFINEMENT TOPOLOGY  //  20 TESLA',
    headlineLines: ['NO WALL', 'CAN TOUCH', 'A STAR.'] as const,
    modes: [
      { id: 'tokamak' as CageMode, label: 'TOKAMAK [SYMMETRIC TORUS]' },
      { id: 'stellarator' as CageMode, label: 'STELLARATOR [5-FOLD HELIX]' },
    ] as const,
    fieldRingText: 'MAGNETIC CONFINEMENT FIELD  //  20 TESLA  //  ZERO CONTACT  //  ',
    telemetryStrip: 'COIL TEMP: -269°C  //  PLASMA CORE: 150M°C  //  ΔT: 150,000,269 K',
  },
  act4: {
    eyebrow: 'ACT 04  //  LAWSON TRIPLE PRODUCT  //  n · T · τE',
    headline: 'IGNITION THRESHOLD',
    dials: [
      {
        id: 'density',
        symbol: 'n',
        label: 'DENSITY',
        value: '1.4 × 10²⁰',
        unit: 'm⁻³',
        accent: '#FF1F71',
        progress: 0.68,
      },
      {
        id: 'temperature',
        symbol: 'T',
        label: 'TEMPERATURE',
        value: '150.0',
        unit: 'MK',
        accent: '#00E676',
        progress: 0.82,
      },
      {
        id: 'confinement',
        symbol: 'τE',
        label: 'CONFINEMENT',
        value: '3.20',
        unit: 's',
        accent: '#1822FF',
        progress: 0.61,
      },
    ] as readonly LawsonDialSpec[],
    targetReadout: 'Q = 1.00  //  BREAKEVEN',
  },
  act5: {
    bandA:
      '656.28nm BALMER-ALPHA  ·  486.14nm BALMER-BETA  ·  434.05nm BALMER-GAMMA  ·  410.17nm BALMER-DELTA  ·',
    bandB: 'DEUTERIUM  +  TRITIUM  →  HELIUM-4 (3.5 MeV)  +  NEUTRON (14.1 MeV)  ·',
    wordmark: '656.3nm',
    colophon: 'OPTICAL SPECTROSCOPY ARCHIVE  //  EARTH-BOUND FUSION',
  },
} as const;
