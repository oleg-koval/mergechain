---
name: mergechain-deps
description: Declare and manage MergeChain PR merge-dependencies from the terminal or AI agent. Use when marking a PR blocked by another, setting up stacked-PR dependencies, or during push/open-PR flows for branches based on non-default bases (auto-detect prerequisite). Writes the exact hidden marker used by the MergeChain browser extension so terminal/AI changes appear in the UI and vice-versa. Triggers: "mark #X blocked by #Y", "this PR depends on", "stacked PR", "mergechain deps", "declare merge dep", "use mc-deps", or after creating a follow-up PR.
license: MIT
allowed-tools: Bash, Node
compatibility: Codex, Claude Code, Cursor, GitHub Copilot, Grok, Windsurf, Kiro, and other Agent Skills compatible tools. Requires `gh` CLI (authenticated) + Node 18+.
metadata:
  author: Oleg Koval
  tags:
    - github
    - pull-requests
    - stacked-prs
    - merge-deps
    - pr-dependencies
    - ai-agents
---

# MergeChain Dependencies (mc-deps)

Manage GitHub PR merge dependencies by editing a hidden marker in the PR body using the `gh` CLI. The marker format is byte-identical to the MergeChain browser extension, so changes made here are instantly visible in the UI (and the reverse).

```
<!-- pr-merge-deps:{"v":1,"deps":[{"owner":"o","repo":"r","number":91}]} -->
```

**Primary script:** `skills/mergechain-deps/mc-deps.mjs` (zero npm dependencies).

## Overview

When you (or an AI agent) are building stacked or interdependent features, declare that one PR must land before another. MergeChain then blocks the dependent PR's merge button (in the browser extension) until prerequisites are satisfied. This skill lets agents and terminal flows create, inspect, and clean those declarations reliably.

Direct edges only here — transitive chains and cycle detection are handled by the extension/resolver when reading.

## When to Use

- User or agent says: "mark #143 blocked by #128", "this PR depends on #91", "setup stacked dependency", "declare merge deps".
- Creating follow-up / stacked PRs: after opening a PR whose base is another feature branch, run `auto`.
- In scripted or agent-driven flows (`/ship`, custom push, multi-PR sessions in Cursor/Claude/Copilot/Grok).
- Cross-repo: "acme/db#42 blocks this".
- Inspect current state or clean up markers.
- Do **not** use for editing unrelated PR body text (this tool carefully preserves surrounding content).

## Prerequisites

- `gh` installed and authenticated: `gh auth status`
- Token (or GitHub App) has **Pull requests: read & write** on the involved repos.
- Node 18+ (for the `.mjs` helper).

Refs accept: `123`, `#123`, `owner/repo#123`, or a full `https://github.com/.../pull/NNN` URL. Numbers resolve against current repo.

## Commands

```bash
# Show current deps
node skills/mergechain-deps/mc-deps.mjs show 143

# Add (declare blocked-by). Validates the dep PR exists.
node skills/mergechain-deps/mc-deps.mjs add 143 128
node skills/mergechain-deps/mc-deps.mjs add 143 acme/db#128

# Remove one dep (removes marker entirely if last)
node skills/mergechain-deps/mc-deps.mjs rm 143 128

# Auto-detect for stacked PRs (run after PR exists)
node skills/mergechain-deps/mc-deps.mjs auto 155
```

`add` refuses self-deps, dedupes, and validates the target PR before writing. Removing the last dep strips the marker cleanly.

## Workflows

### 1. On-demand (agent or human)

```bash
# Inside an agent turn or terminal
node skills/mergechain-deps/mc-deps.mjs add 155 143
# Output example:
# added oleg-koval/mergechain#143 — 155 now blocked by [oleg-koval/mergechain#143]
```

### 2. Auto for stacked PRs (most common for multi-PR agents)

After you (or the agent) push a branch and open a PR:

```bash
# The script infers the prerequisite from the base branch
node skills/mergechain-deps/mc-deps.mjs auto <new-pr-number>
```

Typical agent loop:
1. Create feature branch off another feature branch.
2. Make changes, commit, push.
3. Create the PR with `gh pr create ...` (capture the number or URL).
4. `node skills/mergechain-deps/mc-deps.mjs auto <pr>`
5. Tell the user: "Declared dependency on #NNN (inferred from base)".

The `auto` command is safe: if the PR targets default branch or no matching open PR is found, it reports and does nothing.

### 3. Full multi-PR agent session example

```
User: Implement feature X as stacked PRs on top of my auth changes.

Agent:
- Checks out base branch for auth work, opens PR #140 (via gh).
- Runs: node skills/mergechain-deps/mc-deps.mjs auto 140   # (may be no-op if on default)
- Creates feature-x-1 branch off auth branch, implements part 1, opens PR #141.
- Runs: node .../mc-deps.mjs auto 141
  → Inferred: #141 is stacked on "feature/auth" (#140)
- Creates feature-x-2 on top of feature-x-1, opens #142, runs auto.
- Later: user merges #140 → agent can report progress or unblock views via extension.
```

Always surface the exact output from the tool to the user.

## Integration with the Browser Extension

- Marker is the single source of truth.
- Skill sets it → users with the extension see the dependency block, blocked merge button, chains, and "depend on this" reverse list.
- Humans using the extension UI to add/remove deps → `mc-deps show` and `auto` will see the updated state.
- No backend, no drift risk. Perfect for mixed human + agent teams.

Use the **extension** for visual review, autocomplete declaration, and enforcement at merge time. Use this **skill** for creation-time automation and agent flows.

## Verification

After any `add`/`rm`/`auto`:
- The command prints the new state: `XXX now blocked by [list or nothing]`
- `gh pr view NNN --json body` (or the UI) contains the exact `<!-- pr-merge-deps:... -->` comment (or it is absent when empty).
- No duplicate entries.
- Cross-repo refs are preserved correctly.

Example clean marker removal leaves the rest of the PR body untouched.

## Safety & Notes

- This tool only writes **direct** dependencies. For A→B→C declare both edges.
- Never invents a dependency `auto` didn't find.
- Always report `gh` errors (auth, permissions, 404) verbatim.
- Same guarantees and limitations as the extension (client-side block in browser; teammates without the extension can still merge).
- The script and extension codec are kept in sync by design (`src/lib/deps-codec.ts`).

Run with the script path relative to your project when the `skills/` folder has been copied into context, or adjust the path when vendoring the helper.
