# MergeChain Dependencies Skill

Use this skill with AI coding agents (Claude, Cursor, Copilot, Grok, etc.) and terminal scripts to declare and manage PR merge dependencies.

The commands write the same visible managed PR-body section and hidden marker that the [MergeChain browser extension](https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli?utm_source=item-share-cb) uses, so the relationship remains visible without the extension and terminal clients share the same source of truth (though concurrent edits should be avoided).

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

The universal prompt for agents is documented in the main project [README.md](../../README.md#easy-integration-instructions-copy--paste-into-your-agent) (under Automation & AI Agents section). Copy the prompt section and the skill files into your project for the agent to use `mc-deps.mjs`.

The easiest way: copy the whole folder into your project and paste the universal prompt.

## Requirements

- `gh` CLI (authenticated)
- Node 18+

## Learn more

- Main project: https://github.com/oleg-koval/mergechain
- Browser extension: https://chromewebstore.google.com/detail/eaeiiipdodmbdcdpnmafkmomfpahlkli?utm_source=item-share-cb
- Full docs & examples: [SKILL.md](./SKILL.md)
