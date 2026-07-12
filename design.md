# MergeChain Website Design

## Overview

The MergeChain website (https://mergechain.dev) is a lightweight, static marketing site built as a single HTML file (`landing/index.html`) with inline CSS and minimal JS. Its primary goals are:
- Drive installs of the Chrome extension from the Chrome Web Store (primary) or direct ZIP download from GitHub Releases.
- Promote the AI agent skill (`skills/mergechain-deps/`) for developers using Claude, Cursor, Copilot, Grok, etc.
- Demonstrate the core value through an interactive demo that mirrors the real extension UI.
- Educate on no-backend architecture, cross-repo/transitive support, and honest limitations.

The site must feel cohesive with the extension's own UI (popup and settings pages use similar dark theme + system fonts) while being more marketing-oriented.

## Design Principles (from .impeccable.md)

(See .impeccable.md for full Design Context. Key excerpts:)
- Honest, practical, no hype. "Strong nudge and shared source of truth."
- Target: GitHub power users/teams doing stacked PRs + AI-assisted developers.
- Aesthetic: Clean, technical, dark theme, GitHub-native but refined. Functional first.
- Avoid generic AI slop: No overused fonts (beyond system), no repeated card grids without purpose, intentional details.

## Current Structure (as of latest iteration)

- **Header**: Brand (icon + "MergeChain") + nav (How it works, Install, AI Agents, GitHub, AI Skill).
- **Hero**: Eyebrow, h1 with icon, lede (mentions AI agents + store/ZIP), CTA row (primary "Add to Chrome" with store UTM link, ghost "View source", note), small links row (Store, Download ZIP, GitHub + AI Skill).
- **Interactive Demo**: Card mimicking GitHub PR with dependency block (blocked/ready states), toggle simulation. Shows the core value concretely.
- **Features**: 3-column grid (Blocks the merge, Cross-repo & transitive, No backend).
- **How it works**: 3-step numbered grid.
- **Install**: Ordered list with buttons/links for Store (primary), Download ZIP (from releases), build from source, sign-in step.
- **AI Agents**: Dedicated section with universal prompt (copy-paste ready), 4-column grid of per-tool instructions (Claude, Cursor, Copilot, Grok+), note on compatibility, screenshots of results.
- **Footer**: Brand, links (built by, GitHub, store, contributing, privacy), disclaimer.

## Visual & Aesthetic Guidelines

- **Theme**: Dark (GitHub dark inspired: #0d1117 ground, surfaces #161b22/#10151c, borders #30363d). Accents: blue #2f81f7 (primary), red #f85149 (blocked), green #3fb950 (ready/merged), purple #a371f7 (for chains?).
- **Typography**: System sans (-apple-system, BlinkMacSystemFont, "Segoe UI") + monospace (ui-monospace, SFMono). Clear hierarchy. Use clamp for fluid headings on marketing sections; consistent sizing elsewhere. Monospace for code, paths, commands.
- **Layout**: Max-width container (900px), generous padding. Grids for features/steps (collapse to 1-col on mobile). Asymmetry in hero (demo card). Varied spacing for rhythm.
- **Components**:
  - Buttons: Primary (solid accent), ghost (bordered). Small sizes in lists.
  - Demo block: Bordered, with rail for icon, main content. State toggles (is-clear).
  - Pills: For states (blocked/ready).
  - Pre/code: For prompts and commands.
  - Icons: Simple inline SVGs or PNGs (brand icon-32.png used in header/hero).
- **Motion**: Minimal. Demo has subtle transitions on toggle. Respect reduced-motion.
- **Responsive**: Mobile-first collapse. Nav hides on small screens.
- **Accessibility**: Good contrast (dark theme), focus states, aria labels where interactive (demo), semantic HTML.

## Key Pages/Sections Priorities

1. **Hero + Demo**: Most important. Must immediately communicate the problem and solution. Demo should feel "real" (not toy-like).
2. **Install**: Clear options hierarchy (Store primary, ZIP secondary, source tertiary). Link to releases for ZIP.
3. **AI Agents**: Highlight differentiator. Universal prompt front-and-center. Per-tool details. Screenshots showing real extension UI after agent use.
4. **Features/How it works**: Concise, scannable. Use the 3-step for education.
5. **Overall**: Honest disclaimer in footer. Links to GitHub, skill folder, store (with UTM for tracking).

## Recent Updates (to maintain)

- Store links use full UTM: `?utm_source=item-share-cb`
- Download ZIP CTA near hero and in install (points to /releases/latest).
- AI section with prompt + adapters + screenshots.
- Improved meta/SEO (title includes "AI Agent Skill", richer descriptions, keywords).
- Favicon + icon usage for branding.
- Relative paths fixed for assets/screenshots (use raw GitHub or relative where appropriate for deployment).
- Texts updated for AI focus and clarity.

## Future Considerations

- If adding more pages: Keep consistent dark theme, fonts, spacing scale.
- Extension UI consistency: Popup/settings use similar dark + system fonts + accent. Align colors/states.
- Performance: Keep single-file or minimal assets. No heavy frameworks.
- Testing: Visual regression on demo states, mobile, reduced motion.
- Content: Update as product evolves (e.g., once demo video is added, embed it).

## Anti-Patterns to Avoid

- Generic "AI tool" aesthetics (neon, excessive gradients, overused cards).
- Inconsistent linking (always use UTM for store).
- Hype language (stick to honest, grounded tone from LAUNCH.md).
- Poor hierarchy or dense text blocks.

This document, combined with .impeccable.md, guides all website and related UI work.
