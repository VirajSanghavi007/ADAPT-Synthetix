# ADAPT-Synthetix 2.0 — Landing Page

React + Vite landing page for the ADAPT-Synthetix 2.0 project.

## Setup

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

## Folder structure

```
adapt-synthetix-frontend/
├── index.html              # Vite entry HTML (loads fonts, mounts #root)
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx             # React root render
│   ├── App.jsx               # Composes all page sections
│   ├── index.css             # Design tokens (CSS variables) + base styles
│   └── components/
│       ├── Nav.jsx / .css           # Top nav bar
│       ├── Hero.jsx / .css          # Hero headline + subhead
│       ├── Waveform.jsx / .css      # Animated signature waveform visual
│       ├── WhatItDoes.jsx / .css    # 3-card "what it does" section
│       ├── HowItWorks.jsx / .css    # Signal-path flow steps
│       ├── WhyItMatters.jsx / .css  # Value proposition section
│       └── Footer.jsx / .css        # Footer
└── public/                  # Static assets (favicon, etc.)
```

Each section of the page is its own component with a co-located stylesheet,
so you (or teammates) can edit one section without touching the others.
Shared design tokens (colors, fonts) live in `src/index.css` as CSS
variables — change them there to re-theme the whole page.
