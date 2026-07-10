---
name: mergechain-deps
description: Declare and manage MergeChain PR merge-dependencies from the terminal. Use when the user wants to mark a pull request as blocked by / depending on another PR, set up a stacked-PR dependency, or when opening/pushing a PR that is based on another feature branch (auto-detect the prerequisite). Writes a marker into the PR body that is byte-compatible with the MergeChain browser extension, so deps set here show up in the extension and vice-versa. Triggers: "mark #X blocked by #Y", "set PR dependency", "this PR depends on", "stacked PR", "mergechain deps", or during a push / open-PR flow for a branch based on a non-default base.
---

# MergeChain dependencies (mc-deps)

Manage PR merge dependencies by editing a hidden marker in the PR body via `gh`.
The marker is identical to what the MergeChain extension writes, so the two stay
in sync:

```
<!-- pr-merge-deps:{"v":1,"deps":[{"owner":"o","repo":"r","number":91}]} -->
```

Helper: `skills/mergechain-deps/mc-deps.mjs` (Node 18+, uses `gh`; no npm deps).

## Prerequisites
- `gh` is installed and authenticated (`gh auth status`).
- The token/GitHub App has **Pull requests: read & write** on the repos involved.

## On-demand use

Refs accept `123`, `#123`, `owner/repo#123`, or a full PR URL. Bare numbers
resolve against the current repo (`gh repo view`).

```bash
node skills/mergechain-deps/mc-deps.mjs show 143            # list #143's deps
node skills/mergechain-deps/mc-deps.mjs add  143 128        # #143 is blocked by #128
node skills/mergechain-deps/mc-deps.mjs add  143 acme/db#128  # cross-repo dependency
node skills/mergechain-deps/mc-deps.mjs rm   143 128        # remove the dependency
```

`add` validates the dependency PR exists before writing (a typo won't persist),
refuses self-dependencies, and dedupes. Removing all deps strips the marker so
the body reads clean.

Cycles and transitive chains: this tool sets **direct** edges only; MergeChain
(and the resolver) handle transitivity and cycle detection at read time. If the
user asks for a chain (A→B→C), add each direct edge (B add A; C add B).

## Auto-detect during push / open-PR (stacked PRs)

When a PR is based on another feature branch (not the default branch), the PR on
that base branch is its prerequisite. After the PR exists, run:

```bash
node skills/mergechain-deps/mc-deps.mjs auto <this-pr>
```

`auto` reads the PR's base branch, finds the open PR whose **head** is that
branch, and adds it as a dependency. If the PR targets the default branch, or no
open PR owns the base branch, it does nothing and says so — safe to always run.

### Hooking into a push / PR-creation flow
Run `auto` as the final step **after** the PR is created (it needs the PR
number and base branch to exist). In a push/ship flow:
1. Push the branch and create the PR as usual.
2. `node skills/mergechain-deps/mc-deps.mjs auto <new-pr-number>`
3. Report what it inferred (it prints the inferred prerequisite, or that there
   was none). Do not invent a dependency the tool didn't find.

This composes with the user's existing push helpers (e.g. `/push-pr`, `/ship`):
call `auto` once the PR URL/number is known.

## Reporting
Always surface what changed: after `add`/`rm`/`auto`, the tool prints the PR's
new dependency set. Relay that to the user rather than assuming success — and if
`gh` errors (auth, 404, permissions), show the message; don't retry silently.

## Notes
- No backend, no state beyond the PR body — same guarantees as the extension.
- The marker lives on its own trailing line; surrounding PR description text is
  preserved verbatim (strip → re-append on every edit).
