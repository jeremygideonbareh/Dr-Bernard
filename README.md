# Dr. Bernard T. Lyngdoh — Neuro & Spine Clinic (concept demo)

A motion-led concept website for Dr. Bernard T. Lyngdoh Ryntathiang's Neuro & Spine Clinic in Demthring, Shillong.

**Concept:** "Aligned, like standing stones." The stacked monoliths of the Khasi Hills echo the vertebrae of a spine, and the clinic's work is alignment.

## Stack
- Static HTML/CSS/JS with no build step, served by GitHub Pages
- GSAP 3.13 + ScrollTrigger for all motion
- Lenis as the only smooth-scroll engine
- Three.js 0.160: a procedural 24-vertebra spine with custom shaders (scan band, travelling nerve pulse) in the hero
- Iconify (Solar icon set)

## Motion
Includes:
- **Load and hero:** a C1→L5 preloader, a 3D spine that assembles then fans apart on scroll
- **Navigation:** a vertebra progress rail, custom cursor, magnetic buttons
- **Horizontal motion:** a velocity-skewed marquee, a pinned horizontal Care track with in-track parallax, opposing photo reels
- **Vertical motion:** word-split heading reveals, a scrubbed quote, a drawn path line
- **Detail:** 3D tilt tiles, a rising footer wordmark

Respects `prefers-reduced-motion`, which shows static final states and a poster image, and works without JavaScript.

## Content and credits
Details come from public listings and must be confirmed by the clinic before launch. Location photos are from Google Maps contributors, for preview only. The portrait comes from the HexaHealth listing. The conference banner is from INDSPNCON 2024 / Docthub. The quote is from The Shillong Times, 20 Oct 2016. The booking form is a demo and is not connected.
