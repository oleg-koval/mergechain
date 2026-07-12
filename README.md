# MergeChain

**Stop merging pull requests out of order.** MergeChain adds *merge
dependencies* to GitHub PRs: declare that a PR is _blocked by_ another (in the UI or via the included terminal skill for agents), and the
merge button greys out until the prerequisite lands.

[![CI](https://github.com/oleg-koval/mergechain/actions/workflows/ci.yml/badge.svg)](https://github.com/oleg-koval/mergechain/actions/workflows/ci.yml)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Add%20to%20Chrome-4285F4?logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli?utm_source=item-share-cb)
[![GitHub stars](https://img.shields.io/github/stars/oleg-koval/mergechain?style=social)](https://github.com/oleg-koval/mergechain/stargazers)

> No backend. Dependency data lives inside the PR itself. Your token never
> leaves your browser. (Not affiliated with or endorsed by GitHub, Inc.)

![MergeChain blocking a pull request](https://raw.githubusercontent.com/oleg-koval/mergechain/main/docs/screenshots/01-blocked.png)

See the [live demo on mergechain.dev](https://mergechain.dev) for the full interactive experience (including the hero demo).

## The problem

Stacked PRs and shared-file changes get merged in the wrong order all the time.
The usual fix is a `do not merge before #123` comment that everyone forgets.
MergeChain makes that dependency explicit and enforces it at the merge button.

## What MergeChain does

- **Blocks the merge button** while any dependency (direct _or_ transitive) is
  unmerged, with a tooltip naming the blocker.
- **Blocked by / Blocks** — declare a dependency in either direction from one
  inline control; flip an existing one with a click.
- **Transitive chains** (A → B → C) with **cycle detection**, and **cross-repo**
  deps (`owner/repo#123`).
- **"Depend on this" view** — see which open PRs are waiting on the one you're
  viewing.
- **List badges** on `/pulls` flag which PRs are blocked vs ready.
- **No backend** — the dependency list is stored as a hidden marker in the PR
  description, so teammates with the extension see it automatically.

> **Honest caveat:** the merge block is enforced in _your browser_. A teammate
> without the extension can still merge a "blocked" PR. MergeChain is a strong
> nudge and a shared source of truth, not a server-side branch protection rule.

## How MergeChain compares

| Feature                    | MergeChain                          | Graphite                            | ghstack                             |
|----------------------------|-------------------------------------|-------------------------------------|-------------------------------------|
| **Backend**                | None (data lives in PR)            | Requires Graphite account/cloud    | None                                |
| **Merge enforcement**      | Greys out the GitHub merge button  | CLI + web dashboard                | GitHub status checks (manual)       |
| **AI / agent support**     | First-class (dedicated skill + adapters for Claude, Cursor, Copilot, Grok, etc.) | Basic CLI integration            | None                                |
| **Cross-repo dependencies**| Yes                                | Limited                            | Limited                             |
| **Transitive chains**      | Yes + cycle detection              | Yes                                | Manual                              |
| **Works in browser**       | Yes (no extra UI to learn)         | Separate web app                   | No                                  |
| **Stacked PR creation**    | Works with any workflow + `auto`   | Own CLI (`gt`)                     | Own CLI                             |
| **Cost**                   | Free                               | Free tier + paid plans             | Free                                |
| **Best for**               | Teams using GitHub + AI agents     | Large monorepos wanting full platform | Facebook-style stacked diffs     |

We built MergeChain because we wanted something lightweight that just works with the tools we already use (GitHub + AI coding assistants).

## Quickstart

### For humans (browser)
1. [Add to Chrome](https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli?utm_source=item-share-cb)
2. On any GitHub PR, use the MergeChain UI to declare "Blocked by #123" or "Blocks #456".
3. The merge button turns red until dependencies land.

### For AI agents & stacked PR workflows

See the dedicated section below, or jump straight to the [skill docs](./skills/mergechain-deps/SKILL.md).

After explicit user approval for remote actions, your agent (or script) can create a PR and run:

```bash
node skills/mergechain-deps/mc-deps.mjs auto <pr-number>
```

This auto-detects stacked dependencies and keeps everything in sync with the extension. (Gate all remote mutations behind sign-off per repo guidelines.)

**Download the pre-built ZIP** from [GitHub Releases](https://github.com/oleg-koval/mergechain/releases/latest) for easy sideloading (no build required).

## Automation & AI Agents (Stacked PRs & Multiple PRs)

The browser extension shines for **humans** — visual blocks, autocomplete, reverse "depends on this" views, and enforcement at the merge button.

For **agents and scripted flows** (Claude Code, Cursor, GitHub Copilot, Grok, Codex, Windsurf, custom `/ship` scripts) that create multiple stacked PRs, use the companion **terminal skill**. It writes the **exact same hidden marker** as the extension so everything stays in sync.

### Quick Start (copy-paste ready)

After your agent creates a PR, run:

```bash
node skills/mergechain-deps/mc-deps.mjs auto <pr-number>
```

Other useful commands:

```bash
node skills/mergechain-deps/mc-deps.mjs show 155
node skills/mergechain-deps/mc-deps.mjs add 155 140
node skills/mergechain-deps/mc-deps.mjs add 155 acme/other#72
```

### Easy integration instructions (copy & paste into your agent)

The skill files are usually not present yet. The user first installs the Chrome extension + authorizes it, then adds the skill files to the project. The agent prompt below guides the setup.

**1. Universal prompt** (paste this into Claude, Cursor, Copilot, Grok, etc.):

```text
MergeChain skill is not present in this project.

The user first needs to install:
1. The MergeChain Chrome extension + authorize it with GitHub.
2. The skill files from https://github.com/oleg-koval/mergechain/tree/main/skills/mergechain-deps

Guide the user to set up the skill:
- Create skills/mergechain-deps/ and add mc-deps.mjs
- For Claude: .claude/skills/mergechain-deps/SKILL.md
- For Cursor: .cursor/rules/
- For Copilot: .github/prompts/mergechain-deps.prompt.md (or main skill)

Once installed, after creating any stacked or dependent PR run:
node skills/mergechain-deps/mc-deps.mjs auto <pr-number>

Other commands: show, add, rm

If gh is not authenticated: tell the user "Run 'gh auth login' or re-authorize the MergeChain extension in its Options page."

Always show the exact command output.
```

**2. Per-tool setup (one-time)**

**Claude Code:**
- Copy `skills/mergechain-deps/SKILL.md` (and the `mc-deps.mjs` script) into your project.
- Best: place it at `.claude/skills/mergechain-deps/SKILL.md` or reference the repo path.
- Claude will automatically pick up skills in the project.

**Cursor:**
- Copy `skills/mergechain-deps/adapters/cursor/skills/mergechain-deps/SKILL.md` into your Cursor rules (`.cursor/rules/` or project rules).
- Or simply tell Cursor to read `skills/mergechain-deps/SKILL.md`.

**GitHub Copilot:**
- The file `.github/prompts/mergechain-deps.prompt.md` is already provided.
- Copilot will use it when working in the repo.
- You can also paste the Universal prompt above into custom instructions.

**Grok / xAI:**
- Paste the Universal prompt (or the full `skills/mergechain-deps/SKILL.md`) into your chat or custom instructions.
- Ensure the agent environment has `gh` + Node access.

**Other agents (Windsurf, Kiro, Codex, etc.):**
- Use the matching adapter in `skills/mergechain-deps/adapters/`.
- Or just include the Universal prompt + link to the SKILL.md.

**Real-world agent example**

In Cursor / Claude:

> User: Create a follow-up PR for the auth refactor on top of the current feature branch.
>
> Agent:
> 1. `git checkout -b feature/auth-followup`
> 2. Make changes...
> 3. `git push -u origin feature/auth-followup`
> 4. `gh pr create --title "..." --body "..."` → gets #162
> 5. `node skills/mergechain-deps/mc-deps.mjs auto 162`
>    → "Inferred: #162 is stacked on feature/auth (#155)"
> 6. Reports to you: "Created #162 blocked by #155"

**Screenshots of the result**

After an agent runs `auto`:

- The PR shows the dependency block (same as if you had used the browser UI)
- Merge button is disabled with clear tooltip

![Blocked PR example](https://raw.githubusercontent.com/oleg-koval/mergechain/main/docs/screenshots/01-blocked.png)
![Chain view](https://raw.githubusercontent.com/oleg-koval/mergechain/main/docs/screenshots/04-chain.png)

**Recommended for teams:** Add the `skills/mergechain-deps/` folder to your repo (or at least the script + SKILL.md). Your agents will then automatically handle stacked PR dependencies.

Use **both** the extension (for humans) + this skill (for agents) — they share the same source of truth in the PR body.

See the complete reference: [skills/mergechain-deps/SKILL.md](./skills/mergechain-deps/SKILL.md) (includes adapters for all major tools).

## Install

**From the Chrome Web Store** (recommended): [MergeChain: PR merge dependencies](https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli?utm_source=item-share-cb)

See the full site at [mergechain.dev](https://mergechain.dev) (includes direct ZIP download and AI agent skill).

**Download pre-built ZIP** from the [latest GitHub release](https://github.com/oleg-koval/mergechain/releases/latest), extract it, then in Chrome: `chrome://extensions` → **Developer mode** → **Load unpacked** the folder.

**From source:**

```bash
npm install
npm run build
```

Then in Chrome: `chrome://extensions` → **Developer mode** → **Load unpacked** →
select `dist/`. Open the extension's **Options** and **Sign in with GitHub**
(or paste a fine-grained PAT with Pull requests: read & write).

For teams on private org repos, an org owner installs the companion GitHub App
once — see [SETUP.md](./SETUP.md).

## How it works

- **Storage:** dependencies are a hidden HTML comment in the PR body, written via
  the GitHub API. No server, no database.
- **Declaring:** in the UI (type `#123`, fuzzy title, or `owner/repo#123`), or via the terminal skill (`skills/mergechain-deps/mc-deps.mjs`) for agents and scripts. Both write the same marker.
- **Auth:** GitHub App device-flow sign-in, or a personal access token. The
  token lives in `chrome.storage.local`, is sent only to `api.github.com` from
  the background worker, and the page you browse never sees it. See
  [PRIVACY.md](./PRIVACY.md).

## Settings

| Setting | Purpose |
|---|---|
| **Sign in / token** | GitHub App sign-in, or a fine-grained PAT (Pull requests: read & write). Local only. |
| **Enabled repositories** | One `owner/repo` per line. Empty = run everywhere. |
| **Block placement** | Top of the PR, by the merge box, left gutter, or sidebar. |
| **Max dependency depth** | How deep transitive chains are followed (default 10). |
| **Show dependency block** | Master on/off for the injected UI. |

## Development

```bash
npm run dev        # vite dev server + HMR
npm test           # unit tests (pure core + DOM injection)
npm run test:e2e   # live GitHub E2E (needs a token; see .env.example)
npm run typecheck  # strict tsc
npm run lint       # eslint (functional + strict type-checked)
npm run build      # production build → dist/
npm run package    # build + zip for the Chrome Web Store
```

Strict functional core, effects pushed to the edges. See [CLAUDE.md](./CLAUDE.md)
for the architecture. Third-party notices in [NOTICE.md](./NOTICE.md).

## Community & Contributing

We keep the bar low. Small improvements are appreciated.

- **Report bugs / ideas**: [Open an issue](https://github.com/oleg-koval/mergechain/issues)
- **Send a PR**: See [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Using it with AI?** Tell us — we love hearing real workflows
- **Star the repo** if MergeChain saves you from merge-order headaches

See [CLAUDE.md](./CLAUDE.md) for architecture notes if you're hacking on the code.

## License

Proprietary — see [LICENSE](./LICENSE).
