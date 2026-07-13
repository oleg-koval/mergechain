import { describe, it, expect, beforeAll } from 'vitest';
import type { PrNode, PrRef } from '../src/types/index.js';
import { fetchPr, buildGraph, updatePrBody } from '../src/api/github.js';
import { resolveGraph } from '../src/lib/dependency-graph.js';
import { decodeDeps, upsertDeps } from '../src/lib/deps-codec.js';
import { refKey } from '../src/lib/pr-ref.js';

// Live E2E against a throwaway GitHub repo. Exercises the SAME code the
// extension ships: the GitHub REST client, the deps codec round-tripping
// through a real PR body, and the transitive resolver against real PR states.
//
// The two helpers below mirror service-worker.ts (handleResolve / handleSetDeps)
// exactly — the SW can't be imported here because it registers a chrome.runtime
// listener at module load.

const token = process.env['E2E_GH_TOKEN'] ?? '';
const owner = process.env['E2E_OWNER'] ?? '';
const repo = process.env['E2E_REPO'] ?? '';
const A = Number(process.env['E2E_PR_A']);
const B = Number(process.env['E2E_PR_B']);
const C = Number(process.env['E2E_PR_C']);

const MAX_DEPTH = 10;
const ref = (n: number): PrRef => ({ owner, repo, number: n });

const resolve = async (root: PrRef) => {
  const graph = await buildGraph(token, root, MAX_DEPTH);
  if (!graph.ok) return graph;
  const nodes = new Map<string, PrNode>(
    [...graph.value.values()].map((pr) => [
      refKey(pr.ref),
      { ref: pr.ref, state: pr.state, deps: pr.deps },
    ]),
  );
  return resolveGraph(root, nodes, MAX_DEPTH);
};

const setDeps = async (root: PrRef, deps: readonly PrRef[]) => {
  const cur = await fetchPr(token, root);
  if (!cur.ok) return cur;
  return updatePrBody(token, root, upsertDeps(cur.value.body, deps));
};

const mergePr = async (n: number): Promise<number> => {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${n}/merge`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ merge_method: 'squash' }),
    },
  );
  return res.status;
};

const ready = token !== '' && owner !== '' && repo !== '' && Number.isInteger(A);

describe.skipIf(!ready)('live GitHub E2E', () => {
  beforeAll(async () => {
    // Clean slate: clear any managed dependency data left by a previous run.
    await Promise.all([setDeps(ref(A), []), setDeps(ref(B), []), setDeps(ref(C), [])]);
  });

  it('writes a dependency into the real PR body and reads it back', async () => {
    const set = await setDeps(ref(B), [ref(A)]);
    expect(set.ok).toBe(true);

    const after = await fetchPr(token, ref(B));
    expect(after.ok).toBe(true);
    if (after.ok) {
      console.log(`PR #${B} body now contains:\n${after.value.body}`);
      expect(after.value.body).toContain('### Merge dependencies');
      expect(after.value.body).toContain(`- ${owner}/${repo}#${A}`);
      const decoded = decodeDeps(after.value.body);
      expect(decoded).toEqual({ ok: true, value: [ref(A)] });
    }
  });

  it('reports B as blocked while A is open', async () => {
    const r = await resolve(ref(B));
    expect(r.ok).toBe(true);
    if (r.ok) {
      console.log(`resolve(#${B}): blocked=${r.value.blocked}, blocking=[${r.value.blocking.map((x) => x.number).join(',')}]`);
      expect(r.value.blocked).toBe(true);
      expect(r.value.blocking.map((x) => x.number)).toEqual([A]);
    }
  });

  it('resolves a transitive chain C -> B -> A', async () => {
    const set = await setDeps(ref(C), [ref(B)]);
    expect(set.ok).toBe(true);

    const r = await resolve(ref(C));
    expect(r.ok).toBe(true);
    if (r.ok) {
      console.log(`resolve(#${C}): blocked=${r.value.blocked}, order=[${r.value.order.map((x) => x.number).join(',')}]`);
      expect(r.value.blocked).toBe(true);
      // dependency-first order: A (deepest) then B
      expect(r.value.order.map((x) => x.number)).toEqual([A, B]);
    }
  });

  it('detects a cycle when A is made to depend on C (A -> C -> B -> A)', async () => {
    await setDeps(ref(A), [ref(C)]);
    const r = await resolve(ref(A));
    console.log(`resolve(#${A}) with cycle: ok=${r.ok}${r.ok ? '' : `, error=${r.error.kind}`}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('cycle');
    await setDeps(ref(A), []); // break the cycle before merging
  });

  it('unblocks B and re-scopes C after A is merged', async () => {
    const status = await mergePr(A);
    console.log(`merge #${A} -> HTTP ${status}`);
    expect([200, 201].includes(status)).toBe(true);

    const rb = await resolve(ref(B));
    expect(rb.ok).toBe(true);
    if (rb.ok) {
      console.log(`resolve(#${B}) after merge: blocked=${rb.value.blocked}`);
      expect(rb.value.blocked).toBe(false);
    }

    const rc = await resolve(ref(C));
    expect(rc.ok).toBe(true);
    if (rc.ok) {
      console.log(`resolve(#${C}) after merge: blocking=[${rc.value.blocking.map((x) => x.number).join(',')}]`);
      expect(rc.value.blocked).toBe(true);
      expect(rc.value.blocking.map((x) => x.number)).toEqual([B]);
    }
  });
});
