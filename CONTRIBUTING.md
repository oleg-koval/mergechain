# Contributing to MergeChain

Thanks for your interest! We keep things lightweight.

## Quick start for contributors

```bash
git clone https://github.com/oleg-koval/mergechain.git
cd mergechain
npm install
npm run typecheck
npm test
npm run build
```

## What we care about

- Keep the extension small and the core pure (see `CLAUDE.md`)
- The skill (`skills/mergechain-deps/`) should stay simple — no new dependencies
- New features should work for both humans (browser) **and** AI agents

## How to contribute

1. Fork + create a branch from `main`
2. Make your change
3. Run `npm run typecheck` + `npm test` + `npm run lint`
4. Open a PR targeting `main` (contributions must target `main`)

Small docs tweaks, new agent examples, or bug fixes are very welcome.

## Questions?

Open an issue or ping us on the PR. We're happy to help.

Thanks for helping make stacked PRs less painful!
