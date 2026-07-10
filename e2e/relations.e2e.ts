import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PrRef } from '../src/types/index.js';
import { fetchPr, listOpenPrs, updatePrBody, buildGraph } from '../src/api/github.js';
import { resolveGraph } from '../src/lib/dependency-graph.js';
import { upsertDeps } from '../src/lib/deps-codec.js';
import { refKey } from '../src/lib/pr-ref.js';
import type { PrNode } from '../src/types/index.js';

// Live E2E for the relationship edits (Blocks / Blocked by / flip / reverse
// remove). Mirrors the service-worker handlers exactly, run against the real
// repo so we exercise the actual GitHub read-modify-write path the user hit a
// bug in. Uses only OPEN PRs and cleans up after itself — never merges.

const token = process.env['E2E_GH_TOKEN'] ?? '';
const owner = process.env['E2E_OWNER'] ?? 'oleg-koval';
const repo = process.env['E2E_REPO'] ?? 'pr-deps-e2e';
const B = Number(process.env['E2E_PR_B'] ?? 2);
const C = Number(process.env['E2E_PR_C'] ?? 3);
const D = Number(process.env['E2E_PR_D'] ?? 4);
const ready = token !== '';
const ref = (n: number): PrRef => ({ owner, repo, number: n });

const must = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`op failed: ${JSON.stringify(r.error)}`);
  return r.value;
};

const dedupe = (refs: readonly PrRef[]): readonly PrRef[] => {
  const seen = new Set<string>();
  return refs.filter((d) => {
    const k = refKey(d);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// --- mirrors of the service-worker handlers ---
const setDeps = async (r: PrRef, deps: readonly PrRef[]): Promise<void> => {
  const cur = must(await fetchPr(token, r));
  must(await updatePrBody(token, r, upsertDeps(cur.body, deps)));
};
const addDep = async (from: PrRef, dep: PrRef): Promise<void> => {
  const cur = must(await fetchPr(token, from));
  must(await updatePrBody(token, from, upsertDeps(cur.body, dedupe([...cur.deps, dep]))));
};
const removeDep = async (from: PrRef, dep: PrRef): Promise<void> => {
  const cur = must(await fetchPr(token, from));
  must(await updatePrBody(token, from, upsertDeps(cur.body, cur.deps.filter((d) => refKey(d) !== refKey(dep)))));
};
const flip = async (current: PrRef, other: PrRef, blockedBy: boolean): Promise<void> => {
  if (blockedBy) {
    await removeDep(current, other);
    await addDep(other, current);
  } else {
    await removeDep(other, current);
    await addDep(current, other);
  }
};

const depsOf = async (r: PrRef): Promise<readonly number[]> =>
  must(await fetchPr(token, r)).deps.map((d) => d.number);
const dependentsOf = async (target: PrRef): Promise<readonly number[]> =>
  must(await listOpenPrs(token, owner, repo))
    .filter((pr) => pr.deps.some((d) => refKey(d) === refKey(target)))
    .map((pr) => pr.ref.number);

describe.skipIf(!ready)('live relationship edits', () => {
  beforeAll(async () => {
    await Promise.all([setDeps(ref(B), []), setDeps(ref(C), []), setDeps(ref(D), [])]);
  });
  afterAll(async () => {
    await Promise.all([setDeps(ref(B), []), setDeps(ref(C), []), setDeps(ref(D), [])]);
  });

  it('"Blocks": adding B as a dependent of D writes D into B and D sees B', async () => {
    await addDep(ref(B), ref(D)); // from B's POV: B depends on D  → D is blocked-by... i.e. D blocks B
    expect(await depsOf(ref(B))).toContain(D);
    expect(await dependentsOf(ref(D))).toContain(B); // D shows "B depends on this"
  });

  it('reverse remove: clearing the dependent from D removes D from B', async () => {
    await removeDep(ref(B), ref(D)); // what the × on D's dependent row does
    expect(await depsOf(ref(B))).not.toContain(D);
    expect(await dependentsOf(ref(D))).not.toContain(B);
  });

  it('flip blocked-by → blocks moves the edge to the other PR', async () => {
    await setDeps(ref(C), [ref(D)]); // C is blocked by D (D ∈ C.deps)
    expect(await depsOf(ref(C))).toContain(D);

    await flip(ref(C), ref(D), true); // flip from C's row where it's "blocked by"
    expect(await depsOf(ref(C))).not.toContain(D); // edge left C
    expect(await depsOf(ref(D))).toContain(C); // and landed on D (C now depends on D)
  });

  it('flip blocks → blocked-by moves it back', async () => {
    // From the previous test, D depends on C. On C's page that shows as a dependent.
    await flip(ref(C), ref(D), false); // flip the "blocks" edge back
    expect(await depsOf(ref(D))).not.toContain(C);
    expect(await depsOf(ref(C))).toContain(D);
  });

  it('an unreachable dependency does not wipe the graph — buildGraph skips it, resolver warns', async () => {
    await setDeps(ref(C), [{ owner, repo, number: 999999 }]); // a PR that does not exist
    const graph = must(await buildGraph(token, ref(C), 10));
    // The root loaded and the bogus dep was skipped (not in the node map).
    expect(graph.has(refKey(ref(C)))).toBe(true);
    expect(graph.has(refKey({ owner, repo, number: 999999 }))).toBe(false);

    const nodes = new Map<string, PrNode>(
      [...graph.values()].map((pr) => [refKey(pr.ref), { ref: pr.ref, state: pr.state, deps: pr.deps }]),
    );
    const resolved = resolveGraph(ref(C), nodes, 10);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.error.kind).toBe('missing-node');
  });
});
