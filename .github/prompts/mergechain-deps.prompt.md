<!-- Generated adapter for GitHub Copilot. Reference the canonical skill. -->

---
description: "Declare and manage MergeChain PR merge-dependencies from terminal/AI. Keeps the hidden marker in sync with the MergeChain browser extension."
---

Use the mergechain-deps skill.

# MergeChain Dependencies (mc-deps)

Manage GitHub PR merge dependencies by editing a hidden marker in the PR body using the `gh` CLI. The marker format is byte-identical to the MergeChain browser extension.

**Script:** `skills/mergechain-deps/mc-deps.mjs`

Key Commands
------------

- `node skills/mergechain-deps/mc-deps.mjs show <pr>`
- `node skills/mergechain-deps/mc-deps.mjs add <pr> <dep>` (validates existence)
- `node skills/mergechain-deps/mc-deps.mjs rm <pr> <dep>`
- `node skills/mergechain-deps/mc-deps.mjs auto <pr>` (best for stacked PRs after `gh pr create`)

Typical Agent Flow for Stacked PRs
----------------------------------
1. Branch + implement.
2. **Require explicit approval** before `gh pr create`, auto, or any remote mutation.
3. `gh pr create` (capture number).
4. `node skills/mergechain-deps/mc-deps.mjs auto <pr>`
5. Report the result.

See `skills/mergechain-deps/SKILL.md` (in this repo) for full workflows, examples, verification, safety notes, and how it complements the browser extension.

Refs support: 123 | #123 | owner/repo#123 | full URL.
