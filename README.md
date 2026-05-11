# Kulay

An OKLCH-based color palette generator for design systems. Create perceptually uniform color scales, export to CSS/Tailwind/JSON, and fine-tune contrast ratios against WCAG targets — all in the browser, no account needed.

## Features

- **OKLCH color space** — perceptually uniform lightness ramp so 500→600 always looks like the same step visually
- **Smart naming** — auto-names palettes from hue + lightness (Navy, Blush, Forest, Powder…) calibrated against Tailwind 500 anchors
- **Per-palette lightness range** — override the project-wide lightest/darkest values for individual scales
- **Label scales** — generate step labels in 0–10, 0–100, or 0–1000 format, snapped to readable grids
- **WCAG contrast check** — live contrast ratio table for every step against every other step
- **Dark mode generation** — one click to generate a mirrored dark-mode ramp
- **Export** — CSS custom properties, Tailwind config, or JSON

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v3 · Zustand · OKLCH

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # outputs to dist/
npm run preview # preview the production build locally
```

## Deployment

Configured for Netlify. Push to the connected branch and Netlify will run `npm run build` and serve `dist/`. The `netlify.toml` and `public/_redirects` handle the SPA catch-all.
