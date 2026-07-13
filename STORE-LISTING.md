# Chrome Web Store — listing & compliance

## Listing copy

**Name:** MergeChain — PR merge dependencies

**Summary (132 chars max):**
GitLab-style merge dependencies for GitHub pull requests. Block merging until prerequisite PRs land.

**Description:**
MergeChain brings GitLab-style merge-request dependencies to GitHub pull
requests. Declare that one PR must merge before another, and MergeChain shows
the dependency status right above the merge box and disables the merge button
until every prerequisite has landed.

- Declare "Blocked by" / "Blocks" relationships from a single inline control
- Transitive chains (A → B → C) with cycle detection
- Cross-repo dependencies (owner/repo#123)
- Reverse "depend on this" view, with one-click flip and remove
- Choose where the block appears (top, bottom, left gutter, or sidebar)
- No backend: dependency data is stored in the PR description; your token stays
  in your browser and only ever contacts GitHub

Note: the merge block is enforced in your browser; teammates without the
extension can still merge. Install the companion GitHub App (or use a token) to
read and update PRs. Not affiliated with or endorsed by GitHub, Inc.

**Category:** Developer Tools
**Language:** English

## Single purpose (required field)

"Display and manage merge-order dependencies between GitHub pull requests."

## Permission justifications (required by CWS review)

- **storage** — Persist the user's GitHub token and preferences locally on the
  device. No remote storage.
- **host permission `https://api.github.com/*`** — Call the GitHub REST API
  (authenticated with the user's own token) to read pull requests and write the
  managed dependency section and marker into a PR description.
- **host permission `https://github.com/*`** — Inject the dependency UI on PR
  pages and run the OAuth device-flow sign-in (`github.com/login/...`).

No other permissions are requested. No `tabs`, no broad `<all_urls>`, no remote
code.

## Data usage disclosure (CWS form)

- Does the item collect user data? **No data is collected by the developer.**
  The token and settings are stored locally; API calls go directly to GitHub.
- Selling data: No. Sharing: No. Used for unrelated purposes: No.

## Privacy policy URL

Host `PRIVACY.md` (e.g. GitHub Pages / repo raw URL) and paste the link in the
listing's Privacy tab. Required because the extension handles an auth token.

## Assets to upload

- Store icon: `icons/icon-512.png` (provided; 512×512, will be shown at 128).
- Screenshots (1280×800 PNG, ready in `docs/screenshots/`): `01-blocked.png`,
  `02-unblocks.png`, `03-declare.png`, `04-chain.png`, `05-private.png`. Upload
  in that order. Regenerate with `python3 docs/make_screenshots.py`.

## Pre-submit checklist (Chrome Web Store policies)

- [x] Manifest V3
- [x] Single, narrow purpose
- [x] Name does not impersonate GitHub or imply affiliation ("MergeChain", with
      "for GitHub" only as a descriptor; disclaimer in description)
- [x] No GitHub logo / Invertocat used; only MIT-licensed Octicons (see NOTICE.md)
- [x] Minimal permissions, each justified above
- [x] No remote / hosted code; everything is bundled
- [x] Privacy policy provided (PRIVACY.md)
- [x] Data-use disclosures: no data collected by developer
- [x] Screenshots added (`docs/screenshots/01-05`, 1280×800)
- [ ] Privacy policy hosted at a public URL and linked in the listing
- [ ] Trademark clearance on "MergeChain" (your responsibility)
- [ ] GitHub App made public (so other orgs can install) — see SETUP.md

## GitHub-side notes

- The companion GitHub App must be **public** for other orgs to install it.
- The app's `GITHUB_APP_CLIENT_ID` in `src/config.ts` must point to the
  published app (currently a personal app).
