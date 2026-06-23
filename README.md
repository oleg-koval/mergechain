# MergeChain

MergeChain is a Chrome extension that brings [GitLab-style merge request dependencies](https://docs.gitlab.com/user/project/merge_requests/dependencies/)
to GitHub pull requests. (Not affiliated with or endorsed by GitHub, Inc.)

Declare that one PR must merge before another. The extension shows the
dependency status right above GitHub's merge box and **blocks the merge button**
(turns it red, disables it) until every dependency has landed. Works across
repositories and across transitive chains (A → B → C), with cycle detection.

## Why

We track PR dependencies by hand in comments today. People forget, and
downstream PRs get merged before the work they depend on. This makes the
dependency explicit and enforces the order in the UI.

## Features

- **Dependency block** above the merge box, using GitHub's own octicons and
  colors. Clickable rows link straight to each dependency.
- **Merge blocking**: while any dependency (direct or transitive) is unmerged,
  the merge button is disabled and red, with a tooltip naming the blocker.
- **Reverse dependents**: see which open PRs depend on the one you're viewing.
- **List badges** on the `/pulls` page flag PRs that are blocked or have deps.
- **Cross-repo** and **transitive** chains with cycle detection.

## How it works

- **Storage**: dependencies are saved as a hidden HTML comment in the PR body
  via the GitHub API — no backend, the data lives in the PR and is shared with
  everyone automatically.
- **Declaring**: type `#123`, a PR title (fuzzy autocomplete), or
  `owner/repo#123` for a cross-repo dependency.

## Token security

The extension has **no backend**. Your GitHub token is stored in
`chrome.storage.local` on your device and is sent **only** to `api.github.com`,
from the isolated background service worker — the GitHub page you browse never
sees it. The Options page has a **Verify token** button that round-trips the
token to GitHub and shows who it belongs to, so you can confirm where it goes.
Use a fine-grained PAT scoped to **Pull requests: read & write** on just the
repos you need.

## Install (unpacked)

```bash
npm install
npm run build
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → select the `dist/` folder.

Open the extension's **Options** to set:

| Setting | Purpose |
|---|---|
| **GitHub token** | Fine-grained PAT with Pull requests read & write. Stored locally; only ever sent to GitHub. |
| **Enabled repositories** | One `owner/repo` per line. Empty = run everywhere. |
| **Max dependency depth** | How deep transitive chains are followed (default 10). |
| **Show dependency block** | Master on/off for the injected UI. |

## Development

```bash
npm run dev        # vite dev server + HMR
npm test           # unit tests (pure core)
npm run typecheck  # strict tsc
npm run lint       # eslint (functional + strict type-checked)
npm run build      # production build → dist/
```

## Design

Strict functional core, effects pushed to the edges. See [CLAUDE.md](./CLAUDE.md)
for the architecture and the boundary rules.

## License

UNLICENSED — internal tool.
