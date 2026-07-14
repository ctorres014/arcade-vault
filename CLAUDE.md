# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault (`README.md`) — a platform to play games online and compete for the highest score. Currently a freshly scaffolded Next.js app (App Router) with no game features implemented yet.

## Critical: Next.js version

This repo uses **Next.js 16.2.10** with React 19.2.4 — newer than your training data. Before writing App Router code (routing, data fetching, `next/image`, `next/font`, config), check `node_modules/next/dist/docs/01-app/` for current APIs rather than relying on prior knowledge, since conventions may have changed.

## Commands

```bash
npm run dev     # start dev server
npm run build   # production build
npm run start   # run production build
npm run lint    # eslint (flat config, eslint.config.mjs)
```

There is no test runner configured in this project.

## Skills
Usa siempre /frontend-design para disenar interfaces de usuario

## Architecture

- App Router lives in `app/`; `app/layout.tsx` is the root layout, `app/page.tsx` the home page.
- Path alias `@/*` maps to the repo root (`tsconfig.json`).
- Styling is Tailwind CSS v4 via `@tailwindcss/postcss` (`postcss.config.mjs`), with global styles in `app/globals.css`.
- ESLint uses the flat-config format (`eslint.config.mjs`), extending `eslint-config-next` (core-web-vitals + typescript).

## Spec-driven workflow

Per `README.md`, this project follows spec-driven design using `/spec` and `/spec-impl`, based on practices from https://github.com/Klerith/fernando-skills (installed via `npx skills@latest add Klerith/fernando-skills`).
