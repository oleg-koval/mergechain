# MergeChain — launch kit

All copy is grounded: MergeChain is brand-new with no users yet, so nothing here
claims traction, benchmarks, or testimonials. Fill the `{{...}}` placeholders
(the Chrome Web Store listing is now live at https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli).

## Launch angle (one sentence)

For developers and teams who stack PRs on GitHub, MergeChain brings GitLab's
merge-request dependencies to GitHub — declare "this PR is blocked by #123" and
the merge button greys out until the prerequisite lands — because GitHub still
has no native way to enforce merge order, and `do not merge before #123`
comments get ignored.

- **Who:** GitHub users with stacked / interdependent PRs (especially ex-GitLab teams).
- **Painful job:** PRs merged out of order; manual "blocked by" comments forgotten.
- **Why now:** stacked-PR workflows are mainstream; GitHub still lacks this; GitLab has had it for years.
- **Different:** in the native GitHub UI, no backend, transitive + cross-repo, data stored in the PR itself.

## Taglines

- Stop merging GitHub PRs out of order.
- GitLab-style merge dependencies, now on GitHub.
- Block the merge until its dependencies land.
- The "do not merge before #123" comment, enforced.

## One-paragraph announcement

MergeChain is a Chrome extension that adds GitLab-style merge dependencies to
GitHub pull requests. On any PR you can declare "blocked by #123" (or "blocks
#456"), and MergeChain shows the dependency status above the merge box and greys
out the merge button until every prerequisite — direct, transitive, even
cross-repo — has merged. There's no backend: the dependency list is stored as a
hidden marker in the PR description, so anyone on your team with the extension
sees it. Your GitHub token stays in your browser and only ever talks to GitHub.
It's a strong nudge and a shared source of truth, not a server-side rule — and
it's free.

## Social posts (5 variants)

**X / Twitter — pain-first**
GitHub still has no way to say "don't merge this PR until #123 lands." So people
write a comment and someone merges it anyway. MergeChain fixes that: declare the
dependency, the merge button greys out until the prerequisite merges. No backend.
https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli

**X / Twitter — ex-GitLab**
Missed GitLab's merge-request dependencies after moving to GitHub? MergeChain
brings them back: blocked-by / blocks, transitive chains, cross-repo, right in
the GitHub UI. https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli

**X / Twitter — builder note**
Built MergeChain: a GitHub PR merge-dependency extension with no backend — deps
live as a hidden marker in the PR body, token never leaves your browser. MV3,
functional core, fully tested. https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli

**LinkedIn**
If your team stacks pull requests, you've merged one before its dependency at
least once. GitHub has no native fix; GitLab has had merge-request dependencies
for years. MergeChain adds them to GitHub: declare "blocked by #123" and the
merge button stays disabled until the prerequisite lands — across transitive
chains and even other repos. No backend, your token stays local. Free, link
below. https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli

**Reddit (r/github, r/programming) — honest**
I built a Chrome extension that adds GitLab-style merge dependencies to GitHub
PRs. You mark a PR "blocked by #123" and it disables the merge button until #123
merges. Honest caveat: it's client-side, so a teammate without the extension can
still merge — it's a shared nudge, not branch protection. No backend; deps are
stored in the PR description. Feedback welcome. https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli

## Product Hunt

- **Tagline (60 char):** GitLab-style merge dependencies for GitHub pull requests
- **Description:** MergeChain lets you declare that one GitHub PR is blocked by
  another and greys out the merge button until the prerequisite lands —
  transitive chains, cross-repo, cycle detection, no backend. Dependency data
  lives in the PR description; your token never leaves your browser.
- **First comment (maker):** GitHub has no native merge-order enforcement, so I
  rebuilt GitLab's MR dependencies as a zero-backend extension. It's a nudge, not
  branch protection (it's client-side) — happy to answer anything.

## Hacker News (Show HN)

- Show HN: MergeChain – GitLab-style merge dependencies for GitHub PRs
- Show HN: A Chrome extension that blocks merging a GitHub PR until its deps land
- Show HN: Merge-request dependencies for GitHub, with no backend

HN body: lead with the mechanism (hidden marker in the PR body, token stays in
the browser), state the client-side caveat up front, link the source. HN rewards
candor and dislikes hype — no superlatives.

## Outreach (criteria, not spam)

Reach out only where it's genuinely relevant, one personalized message each:
- Authors of GitHub-workflow / stacked-PR tools (Graphite, Sapling, ghstack, spr) — complementary, not competitive.
- Dev-tool newsletters / "show your work" threads (e.g. weekly roundups) that accept submissions.
- Teams publicly complaining about GitHub lacking MR dependencies (search issues, X, Reddit) — answer with a link where it actually helps.
Never mass-DM. Never post the same copy across threads.

## Share loops

- **Visible artifact:** the dependency block + greyed merge button is itself the
  ad — anyone viewing the PR (with the extension) sees it. The hidden marker
  travels with the PR.
- **Before/after demo GIF:** "merge button greys out → merge the dep → it
  unblocks." This is the single most shareable asset; record it first.
- **Team install:** one person adds a dep; teammates see the marker and install
  to act on it — natural intra-team spread.
- **Travelable template:** a short "how we enforce merge order on GitHub" post /
  checklist that links the extension.

## Metrics

- **Activation:** user signs in + declares their first dependency.
- **Share:** click on the "teifi"/maker link removed — instead track CWS listing
  referrals and repo stars/forks.
- **Conversion:** Chrome Web Store install → first dependency created.
- **Retention proxy:** weekly active PRs with a MergeChain marker.
- **Launch-day checklist:** CWS install count, repo stars, HN/PH rank, referral
  sources. (No vanity metrics; track installs → first-use.)

## Risks & assumptions

- **Repo is PRIVATE.** A public OSS / HN / PH launch needs the repo public and
  the extension published. Decide this first.
- **Client-side enforcement** is a real limitation; lead with it, don't hide it
  (HN will find it instantly). Framing it as "shared nudge + source of truth"
  is honest.
- **GitHub App must be public** for other orgs to install; the bundled client_id
  currently points at a personal app.
- **Trademark:** "MergeChain" not cleared; "GitHub" used only nominatively.
- **No traction yet** — every number above is a placeholder; do not invent any.

## Next actions

1. Decide: public launch (repo public + CWS published) or private/internal only.
2. Record `docs/demo.gif` (the unblock loop) + drop the three screenshots in `docs/`.
3. Extension published at https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli — update any remaining references if needed.
4. Host `PRIVACY.md` at a public URL; finish the `STORE-LISTING.md` checklist.
5. Pick one primary channel (Show HN _or_ Product Hunt) for day one; don't split focus.
