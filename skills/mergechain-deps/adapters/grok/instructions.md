# Grok / xAI usage for mergechain-deps

Include (or reference) the content of `skills/mergechain-deps/SKILL.md` in your Grok context or custom instructions when working on GitHub PRs.

Key points for Grok:
- After opening a stacked PR, run `node skills/mergechain-deps/mc-deps.mjs auto <pr>`
- Use `add` / `show` / `rm` for explicit control.
- The marker written is understood by the MergeChain browser extension.
- Always surface the tool's output to the user.
- Refs: numbers, #NNN, owner/repo#NNN, or full PR URLs.

Example prompt addition:
"Use the mergechain-deps skill to manage PR dependencies when creating stacked changes. After gh pr create, call the auto command."
