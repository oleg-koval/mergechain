---
description: "Declare and manage MergeChain PR merge-dependencies (stacked PRs) using gh + the mc-deps helper. Compatible with the browser extension marker."
---

# MergeChain Dependencies (mc-deps)

Use the canonical `SKILL.md` (skills/mergechain-deps/SKILL.md) for full details.

Quick commands (run after PR creation for stacked work):

```bash
node skills/mergechain-deps/mc-deps.mjs auto <pr-number>
node skills/mergechain-deps/mc-deps.mjs add <pr> <dep>
node skills/mergechain-deps/mc-deps.mjs show <pr>
```

See the main skill file for workflows, verification, and how it stays in sync with the MergeChain extension UI.
