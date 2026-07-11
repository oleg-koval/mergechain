# MergeChain Dependencies Skill

Use this skill with AI coding agents (Claude, Cursor, Copilot, Grok, etc.) and terminal scripts to declare and manage PR merge dependencies.

The commands write the same hidden marker that the [MergeChain browser extension](https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli) uses, so everything stays perfectly in sync.

## Quick use

```bash
# After creating a stacked PR
node mc-deps.mjs auto <pr-number>

# Other commands
node mc-deps.mjs show 155
node mc-deps.mjs add 155 140
```

## For AI agents

See [SKILL.md](./SKILL.md) — it contains the full ready-to-use instructions and adapters for:

- Claude Code
- Cursor
- GitHub Copilot (`.github/prompts/`)
- Grok
- Windsurf, Kiro, Codex, and others

The easiest way: copy the whole folder into your project and paste the universal prompt from SKILL.md into your agent.

## Requirements

- `gh` CLI (authenticated)
- Node 18+

## Learn more

- Main project: https://github.com/oleg-koval/mergechain
- Browser extension: https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli
- Full docs & examples: [SKILL.md](./SKILL.md)
