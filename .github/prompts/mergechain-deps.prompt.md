<!-- Generated adapter for GitHub Copilot. Reference the canonical skill. -->

---
description: "Declare and manage MergeChain PR merge-dependencies from terminal/AI. Keeps the hidden marker in sync with the MergeChain browser extension."
---

Use the mergechain-deps skill.

# MergeChain Dependencies (mc-deps)

Manage GitHub PR merge dependencies by editing a hidden marker in the PR body using the `gh` CLI. The marker format is byte-identical to the MergeChain browser extension.

**Script:** `skills/mergechain-deps/mc-deps.mjs`

## Key Commands
- `node skills/mergechain-deps/mc-deps.mjs show <pr>`
- `node ... add <pr> <dep>` (validates existence)
- `node ... rm <pr> <dep>`
- `node ... auto <pr>` (best for stacked PRs after `gh pr create`)

## Typical Agent Flow for Stacked PRs
1. Branch + implement + `gh pr create` (capture number).
2. `node skills/mergechain-deps/mc-deps.mjs auto <pr>`
3. Report the result.

See `skills/mergechain-deps/SKILL.md` (in this repo) for full workflows, examples, verification, safety notes, and how it complements the browser extension.

Refs support: 123 | #123 | owner/repo#123 | full URL.
