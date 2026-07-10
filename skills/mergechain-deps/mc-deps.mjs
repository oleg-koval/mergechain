#!/usr/bin/env node
// mc-deps — read/write MergeChain dependency markers in a GitHub PR body via gh.
//
// The marker format is byte-compatible with the MergeChain extension
// (src/lib/deps-codec.ts), so deps set here appear in the extension's block and
// vice-versa:
//   <!-- pr-merge-deps:{"v":1,"deps":[{"owner":"o","repo":"r","number":91}]} -->
//
// Commands:
//   show <pr>                 print the deps declared on <pr>
//   add  <pr> <dep>           declare <pr> is BLOCKED BY <dep>
//   rm   <pr> <dep>           remove <dep> from <pr>'s deps
//   auto <pr>                 infer the prerequisite from <pr>'s base branch
//                             (a stacked PR) and add it as a dependency
//
// <pr>/<dep> accept: 123 | #123 | owner/repo#123 | a full PR URL.
// Requires: gh (authenticated), Node 18+.

import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PREFIX = 'pr-merge-deps:';
const MARKER = /<!--\s*pr-merge-deps:(.*?)\s*-->/s;
const SCHEMA_VERSION = 1;

const die = (msg) => {
  process.stderr.write(`mc-deps: ${msg}\n`);
  process.exit(1);
};

const gh = (args, input) =>
  execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] }).trim();

// ── ref parsing / formatting ────────────────────────────────────────────────
const refKey = (r) => `${r.owner.toLowerCase()}/${r.repo.toLowerCase()}#${r.number}`;
const fmt = (r) => `${r.owner}/${r.repo}#${r.number}`;

let cachedRepo = null;
const currentRepo = () => {
  if (cachedRepo) return cachedRepo;
  const slug = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
  const [owner, repo] = slug.split('/');
  cachedRepo = { owner, repo };
  return cachedRepo;
};

const parseRef = (raw) => {
  const text = String(raw).trim();
  const url = /github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/.exec(text);
  if (url) return { owner: url[1], repo: url[2], number: Number(url[3]) };
  const cross = /^([\w.-]+)\/([\w.-]+)#(\d+)$/.exec(text);
  if (cross) return { owner: cross[1], repo: cross[2], number: Number(cross[3]) };
  const same = /^#?(\d+)$/.exec(text);
  if (same) return { ...currentRepo(), number: Number(same[1]) };
  die(`could not parse PR reference: "${raw}"`);
};

// ── codec (mirrors deps-codec.ts) ───────────────────────────────────────────
const encodeDeps = (deps) => {
  const seen = new Set();
  const unique = deps.filter((d) => {
    const k = refKey(d);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const normalized = unique.map((d) => ({ owner: d.owner, repo: d.repo, number: d.number }));
  return `<!-- ${PREFIX}${JSON.stringify({ v: SCHEMA_VERSION, deps: normalized })} -->`;
};

const decodeDeps = (body) => {
  const m = MARKER.exec(body || '');
  if (!m || m[1] === undefined) return [];
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    die('the PR body has a malformed pr-merge-deps marker; fix or remove it before editing');
  }
  const deps = data && data.deps;
  if (!Array.isArray(deps)) die('the pr-merge-deps marker has an unexpected shape');
  return deps;
};

const stripDeps = (body) => (body || '').replace(MARKER, '').replace(/\n{3,}/g, '\n\n').trim();

const upsertDeps = (body, deps) => {
  const clean = stripDeps(body);
  if (deps.length === 0) return clean;
  return clean.length === 0 ? encodeDeps(deps) : `${clean}\n\n${encodeDeps(deps)}`;
};

// ── gh helpers ──────────────────────────────────────────────────────────────
const prField = (ref, fields) =>
  JSON.parse(
    gh(['pr', 'view', String(ref.number), '--repo', `${ref.owner}/${ref.repo}`, '--json', fields]),
  );

const setBody = (ref, body) => {
  const tmp = join(tmpdir(), `mc-deps-${ref.number}-${process.pid}.md`);
  writeFileSync(tmp, body);
  try {
    gh(['pr', 'edit', String(ref.number), '--repo', `${ref.owner}/${ref.repo}`, '--body-file', tmp]);
  } finally {
    unlinkSync(tmp);
  }
};

// ── commands ────────────────────────────────────────────────────────────────
const cmdShow = (ref) => {
  const { body } = prField(ref, 'body');
  const deps = decodeDeps(body);
  if (deps.length === 0) {
    process.stdout.write(`${fmt(ref)}: no declared dependencies\n`);
    return;
  }
  process.stdout.write(`${fmt(ref)} is blocked by:\n`);
  deps.forEach((d) => process.stdout.write(`  - ${fmt(d)}\n`));
};

const mutate = (ref, transform, verb) => {
  const { body } = prField(ref, 'body');
  const before = decodeDeps(body);
  const after = transform(before);
  const next = upsertDeps(body, after);
  setBody(ref, next);
  process.stdout.write(`${verb} — ${fmt(ref)} now blocked by [${after.map(fmt).join(', ') || 'nothing'}]\n`);
};

const cmdAdd = (ref, dep) => {
  if (refKey(ref) === refKey(dep)) die('a PR cannot depend on itself');
  // Validate the dependency exists (a typo would otherwise persist silently).
  prField(dep, 'number');
  mutate(
    ref,
    (deps) => (deps.some((d) => refKey(d) === refKey(dep)) ? deps : [...deps, dep]),
    `added ${fmt(dep)}`,
  );
};

const cmdRm = (ref, dep) =>
  mutate(ref, (deps) => deps.filter((d) => refKey(d) !== refKey(dep)), `removed ${fmt(dep)}`);

const cmdAuto = (ref) => {
  const { baseRefName } = prField(ref, 'baseRefName');
  const defaultBranch = gh([
    'repo', 'view', '--repo', `${ref.owner}/${ref.repo}`,
    '--json', 'defaultBranchRef', '-q', '.defaultBranchRef.name',
  ]);
  if (baseRefName === defaultBranch) {
    process.stdout.write(`${fmt(ref)} targets the default branch (${defaultBranch}); nothing to infer.\n`);
    return;
  }
  // A stacked PR: the open PR whose head IS this PR's base is the prerequisite.
  const candidates = JSON.parse(
    gh([
      'pr', 'list', '--repo', `${ref.owner}/${ref.repo}`, '--state', 'open',
      '--head', baseRefName, '--json', 'number',
    ]),
  );
  if (candidates.length === 0) {
    process.stdout.write(
      `${fmt(ref)} is based on "${baseRefName}" but no open PR has that head branch; nothing to infer.\n`,
    );
    return;
  }
  const dep = { ...ref, number: candidates[0].number };
  process.stdout.write(`Inferred: ${fmt(ref)} is stacked on "${baseRefName}" (${fmt(dep)}).\n`);
  cmdAdd(ref, dep);
};

// ── dispatch ────────────────────────────────────────────────────────────────
const [cmd, a, b] = process.argv.slice(2);
if (!cmd || !a) {
  process.stdout.write(
    'usage: mc-deps <show|add|rm|auto> <pr> [dep]\n' +
      '  show <pr>            list a PR\'s dependencies\n' +
      '  add  <pr> <dep>      declare <pr> is blocked by <dep>\n' +
      '  rm   <pr> <dep>      remove <dep> from <pr>\n' +
      '  auto <pr>            infer the stacked-on prerequisite from the base branch\n',
  );
  process.exit(cmd ? 1 : 0);
}
const ref = parseRef(a);
switch (cmd) {
  case 'show':
    cmdShow(ref);
    break;
  case 'add':
    if (!b) die('add needs a dependency: mc-deps add <pr> <dep>');
    cmdAdd(ref, parseRef(b));
    break;
  case 'rm':
    if (!b) die('rm needs a dependency: mc-deps rm <pr> <dep>');
    cmdRm(ref, parseRef(b));
    break;
  case 'auto':
    cmdAuto(ref);
    break;
  default:
    die(`unknown command "${cmd}"`);
}
