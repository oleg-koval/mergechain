import { describe, it, expect } from 'vitest';
import { resolveGraph } from '../src/lib/dependency-graph.js';
import { refKey } from '../src/lib/pr-ref.js';
import type { PrNode, PrRef, PrState } from '../src/types/index.js';

const ref = (n: number, repo = 'gic-live'): PrRef => ({ owner: 'teifi-digital', repo, number: n });

const node = (n: number, state: PrState, deps: readonly PrRef[], repo = 'gic-live'): PrNode => ({
  ref: ref(n, repo),
  state,
  deps,
});

const toMap = (...nodes: readonly PrNode[]): ReadonlyMap<string, PrNode> =>
  new Map(nodes.map((nd) => [refKey(nd.ref), nd]));

const numbers = (refs: readonly PrRef[]): readonly number[] => refs.map((r) => r.number);

describe('dependency-graph', () => {
  it('root with no deps is never blocked', () => {
    const nodes = toMap(node(1, 'open', []));
    const r = resolveGraph(ref(1), nodes, 10);
    expect(r).toEqual({ ok: true, value: { blocked: false, blocking: [], order: [] } });
  });

  it('single open dependency blocks the root', () => {
    const nodes = toMap(node(1, 'open', [ref(2)]), node(2, 'open', []));
    const r = resolveGraph(ref(1), nodes, 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.blocked).toBe(true);
      expect(numbers(r.value.blocking)).toEqual([2]);
    }
  });

  it('a merged dependency does not block', () => {
    const nodes = toMap(node(1, 'open', [ref(2)]), node(2, 'merged', []));
    const r = resolveGraph(ref(1), nodes, 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.blocked).toBe(false);
      expect(numbers(r.value.order)).toEqual([2]);
      expect(r.value.blocking).toEqual([]);
    }
  });

  it('resolves a transitive chain A -> B -> C in dependency-first order', () => {
    const nodes = toMap(
      node(1, 'open', [ref(2)]),
      node(2, 'open', [ref(3)]),
      node(3, 'open', []),
    );
    const r = resolveGraph(ref(1), nodes, 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(numbers(r.value.order)).toEqual([3, 2]);
      expect(numbers(r.value.blocking)).toEqual([3, 2]);
    }
  });

  it('partially-merged chain only reports unmerged PRs as blocking', () => {
    const nodes = toMap(
      node(1, 'open', [ref(2)]),
      node(2, 'open', [ref(3)]),
      node(3, 'merged', []),
    );
    const r = resolveGraph(ref(1), nodes, 10);
    if (r.ok) {
      expect(r.value.blocked).toBe(true);
      expect(numbers(r.value.blocking)).toEqual([2]);
    }
  });

  it('dedupes diamond dependencies (D reached via B and C)', () => {
    const nodes = toMap(
      node(1, 'open', [ref(2), ref(3)]),
      node(2, 'open', [ref(4)]),
      node(3, 'open', [ref(4)]),
      node(4, 'open', []),
    );
    const r = resolveGraph(ref(1), nodes, 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.order.filter((x) => x.number === 4)).toHaveLength(1);
      expect(r.value.order[0]?.number).toBe(4); // deepest dep first
      expect([...numbers(r.value.order)].sort((x, y) => x - y)).toEqual([2, 3, 4]);
    }
  });

  it('detects a direct cycle A -> B -> A', () => {
    const nodes = toMap(node(1, 'open', [ref(2)]), node(2, 'open', [ref(1)]));
    const r = resolveGraph(ref(1), nodes, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('cycle');
  });

  it('detects a deeper cycle A -> B -> C -> B', () => {
    const nodes = toMap(
      node(1, 'open', [ref(2)]),
      node(2, 'open', [ref(3)]),
      node(3, 'open', [ref(2)]),
    );
    const r = resolveGraph(ref(1), nodes, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('cycle');
  });

  it('errors when the chain is deeper than maxDepth', () => {
    const nodes = toMap(
      node(1, 'open', [ref(2)]),
      node(2, 'open', [ref(3)]),
      node(3, 'open', []),
    );
    const r = resolveGraph(ref(1), nodes, 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('depth-exceeded');
  });

  it('errors when a referenced dependency is missing from the snapshot', () => {
    const nodes = toMap(node(1, 'open', [ref(2)]));
    const r = resolveGraph(ref(1), nodes, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('missing-node');
  });

  it('supports cross-repo dependencies', () => {
    const nodes = toMap(
      node(1, 'open', [ref(5, 'other-repo')]),
      node(5, 'open', [], 'other-repo'),
    );
    const r = resolveGraph(ref(1), nodes, 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.blocking[0]).toEqual(ref(5, 'other-repo'));
    }
  });
});
