# 656.3nm

*The Colour of 150 Million Degrees — An interactive Neo-Swiss spectral editorial & WebGL fusion physics experience.*

**[Live Experience → https://6563nm.vercel.app](https://6563nm.vercel.app)**

---

## The Physics Behind the Palette

At **150,000,000 K**, a fusion plasma core is completely stripped of bound electrons. Its thermal bremsstrahlung radiation peaks in the soft X-ray band, rendering the hottest region in the solar system **optically invisible** to the human eye. Every saturated colour observed in **Tokamak Energy's 16,000 FPS ST40 spherical tokamak footage** comes from cooler atomic transitions along the plasma edge—and from solid lithium pellets ablating as they cross the separatrix.

| Wavelength | Transition / Species | Spectral Hex | Physical Origin |
| :--- | :--- | :--- | :--- |
| **656.28 nm** | H-α (`n = 3 → 2`, 1.89 eV) | `#FF1F71` | Deuterium Balmer-alpha plasma edge glow |
| **670.78 nm** | Li I (Neutral Flash, 1.85 eV) | `#FF2A2A` | Neutral lithium ablation on initial pellet impact |
| **548.50 nm** | Li II (Electron Stripped, 5.39 eV) | `#00E676` | Singly ionized lithium emerald shockwave |
| **486.14 nm** | H-β (`n = 4 → 2`, 2.55 eV) | `#00D8FF` | Balmer-beta cyan thermal equilibrium |
| **434.05 nm** | H-γ (`n = 5 → 2`) | `#1822FF` | Balmer-gamma cobalt magnetic confinement plate |
| **410.17 nm** | H-δ (`n = 6 → 2`) | `#6A2BFF` | Balmer-delta ultraviolet-edge dispersion |

---

## 5-Act Interactive Architecture

- **Act 0 — 16,000 FPS Optical Shutter:** High-speed camera calibration wipe sweeping Balmer spectral laser ticks directly into the hero stage.
- **Act 1 — The Invisible Core:** Parametric Miller D-shaped 3D Fresnel plasma toroid with an optically transparent center, 12 metallic coils, and damped-spring variable typography.
- **Act 2 — Drop the Lithium:** Pinned scroll-scrubbed optical shockwave chamber pairing radial colour wipes, a 3D ionized lithium crystal & plasma knot, and a live Fraunhofer emission spectrometer.
- **Act 3 — The Magnetic Cage:** Real-time 3D vertex-morphed **Tokamak ↔ 5-Fold Wendelstein 7-X Stellarator** manifold framed by 14 dark-titanium superconducting ribs, magnetic island tubes, and a `0–20 T` magnetic pinch slider with `< 3.0 T` kink disruption physics.
- **Act 4 — Ignition Threshold:** Interactive Lawson Triple-Product (`n · T · τE`) console driving a live 3D boiling plasma star with an additive Fresnel corona shell, gyroscopic gimbal rings, rotational-inertia dials, and a `260 ms` X-ray ignition flash.
- **Act 5 — Spectral Epilogue:** Opposing Doppler-shear marquees and a Newton's Cradle coupled-spring `656.3nm` wordmark wired directly to a full-width 3D thin-film dispersion prism ribbon.

---

## Tech Stack & Engineering Highlights

- **Core:** React, TypeScript, Vite, Tailwind CSS.
- **Procedural 3D WebGL (`three` + Custom GLSL):** 100% mathematical parametric manifolds, torsion-minimized parallel-transport closed-loop metallic coils, `RoomEnvironment` PMREM studio lighting, and zero external 3D/texture assets or particle-dot slop. Each scene uses a lazy `IntersectionObserver` mount/dispose lifecycle so only active viewport contexts hold GPU resources.
- **60fps Motion Engine (`gsap` + `ScrollTrigger` + `lenis`):** Smooth scroll velocity coupled to CSS custom properties (`--wght`, `--wdth`, `--opsz`, `--slnt`, `--doppler-chroma`), direct DOM/canvas ref updates with zero `useState` churn in `requestAnimationFrame`.
- **Zero-Asset Procedural Audio (Web Audio API):** Real-time harmonic synthesis mapping Balmer emission wavelengths, dial detents, magnetic field sweeps, and ignition overexposure chords without external audio files.

---

## Run Locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```
