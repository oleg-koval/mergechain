#!/usr/bin/env node
// Fails if the vendored adapter copies of SKILL.md drift from the canonical one.
// The Claude and Cursor adapters ship full physical copies of the skill; they
// must stay byte-identical to the source of truth. Run: npm run check:skill-sync
// Fix drift with: node scripts/check-skill-sync.mjs --fix

import { readFileSync, writeFileSync } from 'node:fs';

const CANONICAL = 'skills/mergechain-deps/SKILL.md';
const COPIES = [
  'skills/mergechain-deps/adapters/claude/skills/mergechain-deps/SKILL.md',
  'skills/mergechain-deps/adapters/cursor/skills/mergechain-deps/SKILL.md',
];

const fix = process.argv.includes('--fix');
const canonical = readFileSync(CANONICAL, 'utf8');
const drifted = COPIES.filter((p) => readFileSync(p, 'utf8') !== canonical);

if (drifted.length === 0) {
  console.log(`skill-sync: ${COPIES.length} adapter copies match ${CANONICAL}`);
  process.exit(0);
}

if (fix) {
  drifted.forEach((p) => writeFileSync(p, canonical));
  console.log(`skill-sync: re-synced ${drifted.length} copy(ies) from ${CANONICAL}`);
  process.exit(0);
}

console.error(`skill-sync: ${drifted.length} adapter copy(ies) drifted from ${CANONICAL}:`);
drifted.forEach((p) => console.error(`  - ${p}`));
console.error('Fix with: node scripts/check-skill-sync.mjs --fix');
process.exit(1);
