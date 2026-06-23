# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project Overview

A Chrome extension (Manifest V3) that brings **GitLab-style merge dependencies**
to GitHub pull requests. A developer declares that PR B depends on PR A; the
extension then blocks B's merge button (turns it red, disables it) until A is
merged. Supports **cross-repo** dependencies and **transitive chains** (A → B → C)
with cycle detection. Internal Teifi tool. The injected UI is always attributed
to Teifi (badge in the block header) so it is never confused with native GitHub.

There is no backend. Dependencies are stored as a hidden HTML comment inside the
PR body via the GitHub REST API, so the data lives in the PR forever and is
readable with or without the extension.

## Architecture

The codebase is split by **side-effect boundary**. This split is enforced by ESLint.

### Pure core — `src/lib/` (zero side effects, fully unit-tested)

- `result.ts` — hand-rolled `Result<T, E>` (no exceptions cross the codebase). Zero deps.
- `pr-ref.ts` — parse/format PR references (`#91`, `owner/repo#123`), stable keys.
- `deps-codec.ts` — encode/decode the hidden `<!-- pr-merge-deps:{…} -->` comment.
- `pr-search.ts` — rank PRs for the autocomplete (numeric + fuzzy title).
- `dependency-graph.ts` — resolve the transitive closure, detect cycles, cap depth.

Everything here is pure: no DOM, no network, no `chrome.*`. Held to the strictest
FP rules (no `let`, no mutation, no loops, no classes, no `throw`). **All new
business logic goes here and gets a unit test.**

### Effectful boundaries (relaxed FP rules: loops/`let`/mutation allowed)

- `src/api/github.ts` — the only network module. GitHub REST. Returns `Result`.
  `buildGraph` does the depth-capped BFS that feeds the pure resolver.
- `src/content/dom.ts` — the only DOM-mutation module. Selectors + styling.
- `src/content/index.ts` — orchestration: parse page, resolve, render, re-apply on SPA re-render.
- `src/background/service-worker.ts` — owns the token, runs network + the pure resolver.
- `src/components/*.ts` — pure-ish DOM builders: `(data) => HTMLElement`.
- `src/settings/*` — options page.
- `src/storage.ts` — `chrome.storage.local` access.

### Data flow

```
content script ──message──▶ service worker ──fetch──▶ GitHub API
   (no token)                (holds token)            (REST)
       ▲                          │
       └──── Result<…> ───────────┘   (token never enters page context)
```

The token lives only in the service worker. Content scripts ask it to resolve /
search / set-deps over a typed message protocol (`src/messages.ts`); everything
crosses the boundary as `Result<_, AppError>`.

## Build, Test, Lint

```bash
npm install
npm test          # vitest — pure-core unit tests
npm run typecheck # tsc --noEmit (strict)
npm run lint      # eslint (FP rules + strictTypeChecked)
npm run build     # tsc + vite build → dist/  (loadable unpacked extension)
npm run dev        # vite dev with HMR
```

Load `dist/` via `chrome://extensions` → Developer mode → "Load unpacked".

## Conventions

- **TypeScript strict** + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
- **FP fundamentals**: pure core, `Result` over exceptions, `readonly` everywhere,
  immutable updates (spread, not mutation). Enforced by `eslint-plugin-functional`.
- **No new runtime dependencies** without a strong reason — the extension bundle
  must stay small. The core is currently zero-dependency.
- **ESM** with `.js` import specifiers (NodeNext/bundler resolution).
- New fallible operation? Return `Result`, never `throw` (lint forbids `throw` in core).

## Known fragility

- `src/content/dom.ts` `MERGE_AREA_SELECTORS` targets GitHub's merge box markup.
  GitHub changes this periodically. If the block stops appearing, update that
  cascade first — it is the single point of DOM coupling.

## Not yet done (pre-publish)

- Brand icons (`icon-16/48/128.png` + manifest `icons` block) — see `manifest.config.ts`.
- PR list-view badges (`/pulls` page) — planned for this milestone.
- Live runtime tests against a real GitHub PR (current tests cover the pure core only).

## Git

- Branch off `main`; PRs target `main`.
- **Never** `git push` or run remote-modifying commands without explicit sign-off.
- End commit messages with the Co-Authored-By trailer for Claude Code.
