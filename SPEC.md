# 656.3nm — Specification & Architecture Lock

Single source of truth for design tokens, typography axes, copy governance, anti-slop laws, and the 4-pass execution roadmap.

## 1. Core Concept & Physics-to-Color Mapping
Inspired by ST40 spherical tokamak high-speed optical spectroscopy (16,000 FPS): the 150,000,000 K plasma core emits X-rays and is invisible to the human eye, while the cooler edge burns in Balmer-Alpha Deuterium Pink (`656.28 nm`). Injected lithium pellets flash Neutral Crimson (`Li I`, `670.78 nm`) before snapping to Ionized Emerald (`Li II`, `548.50 nm`) when stripped of an electron.

| Token | Hex | Optical / Structural Role | Ink Pairing |
| :--- | :--- | :--- | :--- |
| `--paper` | `#F6F3EB` | Ceramic Lab Paper (Acts 1 & 4) | `#111114` |
| `--ink` | `#111114` | Carbon Tungsten Ink (Primary dark ink & Act 5) | `#F6F3EB` |
| `--h-alpha` | `#FF1F71` | Balmer-Alpha Deuterium Pink (`656.28 nm`) | `#111114` |
| `--li-neutral` | `#FF2A2A` | Neutral Lithium Crimson (`670.78 nm`) | `#F6F3EB` |
| `--li-ion` | `#00E676` | Ionized Lithium Emerald (`548.50 nm`) | `#111114` |
| `--h-beta` | `#00D8FF` | Balmer-Beta Cyan (`486.14 nm`) | `#111114` |
| `--h-gamma` | `#1822FF` | Balmer-Gamma Cobalt (`434.05 nm`, Act 3 canvas) | `#F6F3EB` / `#EAFF2B` |
| `--acid` | `#EAFF2B` | Acid Tungsten Overlay (Act 3 display ink) | `#1822FF` |
| `--h-delta` | `#6A2BFF` | Balmer-Delta Violet (`410.17 nm`) | `#F6F3EB` |
| `--gold` | `#FFB800` | Solar Epilogue Gold (Act 5 ticker) | `#111114` |
| `--grid-dark` | `rgba(17, 17, 20, 0.13)` | 1px Swiss blueprint gridlines on light surfaces | — |
| `--grid-light` | `rgba(246, 243, 235, 0.22)` | 1px Swiss blueprint gridlines on dark surfaces | — |

## 2. Typography & Variable Axis Bounds
- **Bricolage Grotesque** (Hero, Act 3, Act 4, Act 5 Wordmark)
  - `opsz`: `12..96` (default `96`)
  - `wdth`: `75..100` (default `88`)
  - `wght`: `200..800` (default `800`)
  - Bound exclusively via CSS variables: `font-variation-settings: "opsz" var(--opsz, 96), "wdth" var(--wdth, 88), "wght" var(--wght, 800);`
- **Roboto Flex** (Act 2 Kinetic Spectral Stage & Doppler Velocity Type)
  - `opsz`: `8..144` (default `144`)
  - `slnt`: `-10..0` (default `0`)
  - `wdth`: `25..151` (default `125`)
  - `wght`: `100..1000` (default `900`)
  - Bound exclusively via CSS variables: `font-variation-settings: "opsz" var(--opsz, 144), "slnt" var(--slnt, 0), "wdth" var(--wdth, 125), "wght" var(--wght, 900);`
- **JetBrains Mono** (Telemetry, Equations, Coordinates, Dial Readouts)
  - `wght`: `300..700`
  - Enforced globally: `font-variant-numeric: tabular-nums;`

## 3. Non-Negotiable Anti-Slop Laws
1. **Flat Spectral Colour-Blocking**: Zero dark-mode neon-on-black sci-fi backdrops, zero glowing blur orbs, zero Three.js particle soups, zero glassmorphism, zero drop shadows, zero gradients on UI cards.
2. **Strict `0px` Architectural Geometry**: `border-radius: 0px` on all containers, buttons, badges, tabs, and grids. Only mathematically circular physics gauges, magnetic rings, and SVG dials may be round.
3. **Copy Discipline**: Only strings locked in `src/data/content.ts` may be rendered. Zero marketing buzzwords, zero explanatory paragraphs, zero SaaS feature grids.
4. **Architectural Breathing Room**: Maintain 35%–45% negative space structured by crisp `1px` Swiss blueprint gridlines and zero horizontal overflow (`overflow-x: clip`).
5. **Declarative DOM**: Split kinetic text into words and characters declaratively in React JSX (`KineticText.tsx`). Never mutate React DOM imperatively or tween raw `font-variation-settings` shorthand strings.

## 4. 4-Pass Build Roadmap
- **Pass 0 & Pass 1 (Completed)**: Locked `SPEC.md` + `src/data/content.ts`, verified Google Fonts, `src/tokens.css`, Pass-2-ready `KineticText.tsx`, pure parametric SVG geometry (`src/physics/geometry.ts`), and the complete frozen static 5-act Swiss exhibition poster (`SwissChrome`, `Act1Hero`, `Act2Lithium`, `Act3Cage`, `Act4Ignition`, `Act5Epilogue`).
- **Pass 2 (Completed)**: Installed and wired Lenis + GSAP (`gsap.ticker`, `lagSmoothing(0)`) + Doppler scroll-velocity dispersion & shear + Live `SwissChrome` direct-DOM telemetry + Act 0 Shutter Calibration preloader (`00000 → 16000 FPS`, 4 Balmer laser hairlines, 75ms exposure flash, upward clip-path wipe) + Act 1 choreographed entrance, damped-spring variable typography, and live 14-contour MHD parametric magnetic flux physics.
- **Pass 3 (Completed)**: Act 2 Pinned 16,000 FPS Optical Shockwave Chamber (`ScrollTrigger` pin `+=340%`, multi-ring radial `clip-path` wipes, 60fps HTML5 Canvas optical interferometer fringes, center-out 3D-hinge Roboto Flex typography with hollow streak-camera ghost trails, live `380nm–700nm` Fraunhofer spectrometer + oscilloscope intensity curve & magnetic caliper) + Act 3 Live 3D-Projected Parametric Tokamak ↔ Wendelstein 7-X Stellarator Engine (continuous `morphT` topology morph, interactive 3D orbit with inertia, relativistic helical plasma tracers, 5 edge magnetic islands, and coupled `0.0 T → 20.0 T` magnetic pinch slider with `< 3.0 T` MHD kink disruption).
- **Pass 4 (Completed)**: Surgical Act 2 compact-viewport stage headline framing (`min(8.4vw, 13.5svh)` + bounded center band & `0.07` hinge reveal); Act 4 Live Rotational-Inertia Lawson Ignition Instrument (`n`, `T`, `τE` rotary dials with 6° magnetic detents, `[ AUTO-IGNITE ↗ ]` / `[ QUENCH ↓ ]` GSAP choreography, 24-segment spectral progression bar, pre-ignition thermal stress, 260ms pure-white X-ray flash + expanding shockfront ring, inverted `#111114` burning equilibrium with 60fps double-harmonic burn waveform & `SwissChrome` auto-inversion); Act 5 Epilogue opposing velocity-coupled shear marquees + 7-char coupled Newton's Cradle `656.3nm` wordmark + spectral emission hairlines; and zero-asset procedural Web Audio spectral synthesizer (`[ AUDIO: OFF ]` / `[ AUDIO: ON ]` in `SwissChrome`, muted by default).
