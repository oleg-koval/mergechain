# MergeChain

**Stop merging pull requests out of order.** MergeChain adds *merge
dependencies* to GitHub PRs: declare that a PR is _blocked by_ another, and the
merge button greys out until the prerequisite lands.

![CI](https://github.com/oleg-koval/mergechain/actions/workflows/ci.yml/badge.svg)

> No backend. Dependency data lives inside the PR itself. Your token never
> leaves your browser. (Not affiliated with or endorsed by GitHub, Inc.)

<!-- TODO: add docs/demo.gif — record: add "#123" as Blocked by → merge button greys out → merge #123 → it unblocks. -->
![MergeChain on a pull request](docs/screenshot-block.png)

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

## Install

**From the Chrome Web Store:** _coming soon_ — link will go here.

**From source (now):**

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
- **Declaring:** type `#123`, a PR title (fuzzy autocomplete), or
  `owner/repo#123`. Keyboard-navigable.
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

## License

Proprietary — see [LICENSE](./LICENSE).
