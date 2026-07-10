import { describe, it, expect } from 'vitest';
import type { GraphNode, GraphView } from '../src/messages.js';
import type { PrRef } from '../src/types/index.js';
import { layoutGraph, MAX_GRAPH_NODES, type LaidOutGraph } from '../src/lib/graph-layout.js';
import { refKey } from '../src/lib/pr-ref.js';

// Pure layered-layout tests. We assert on layer/column structure (x grouping)
// and determinism rather than exact pixels, so geometry constants can change
// without churning the suite.

const ref = (n: number): PrRef => ({ owner: 'oleg-koval', repo: 'pr-deps', number: n });

const node = (n: number, role: GraphNode['role'] = 'upstream'): GraphNode => ({
  ref: ref(n),
  title: `PR ${String(n)}`,
  state: 'open',
  role,
  blocking: false,
});

// Narrow a result to the drawable case (fails loudly if the layout bailed).
const drawn = (g: LaidOutGraph): Extract<LaidOutGraph, { tooLarge: false }> => {
  expect(g.tooLarge).toBe(false);
  if (g.tooLarge) throw new Error('expected a drawable layout');
  return g;
};

// The column (x) of a given PR in the laid-out graph.
const xOf = (g: Extract<LaidOutGraph, { tooLarge: false }>, n: number): number => {
  const laid = g.nodes.find((ln) => refKey(ln.node.ref) === refKey(ref(n)));
  expect(laid).toBeDefined();
  return laid?.x ?? -1;
};

describe('layoutGraph', () => {
  it('lays out a single node at the origin column with a positive canvas', () => {
    const g: GraphView = { root: ref(1), nodes: [node(1, 'root')], edges: [] };
    const out = drawn(layoutGraph(g));
    expect(out.nodes).toHaveLength(1);
    expect(out.edges).toHaveLength(0);
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(0);
  });

  it('returns an empty canvas for an empty graph', () => {
    const g: GraphView = { root: ref(1), nodes: [], edges: [] };
    const out = drawn(layoutGraph(g));
    expect(out.nodes).toHaveLength(0);
    expect(out.width).toBe(0);
    expect(out.height).toBe(0);
  });

  it('places a linear chain in strictly increasing columns (merge order)', () => {
    // 1 -> 2 -> 3 : 1 merges first (leftmost), 3 depends on it (rightmost).
    const g: GraphView = {
      root: ref(3),
      nodes: [node(1), node(2), node(3, 'root')],
      edges: [
        { from: ref(1), to: ref(2) },
        { from: ref(2), to: ref(3) },
      ],
    };
    const out = drawn(layoutGraph(g));
    expect(xOf(out, 1)).toBeLessThan(xOf(out, 2));
    expect(xOf(out, 2)).toBeLessThan(xOf(out, 3));
    expect(out.edges).toHaveLength(2);
    // Each edge flows left→right (source right edge is left of target left edge).
    out.edges.forEach((e) => {
      expect(e.x1).toBeLessThanOrEqual(e.x2);
    });
  });

  it('resolves a diamond so the shared sink sits one column past both middles', () => {
    // 1 -> 2, 1 -> 3, 2 -> 4, 3 -> 4. Node 4 must be at layer 2 (longest path).
    const g: GraphView = {
      root: ref(4),
      nodes: [node(1), node(2), node(3), node(4, 'root')],
      edges: [
        { from: ref(1), to: ref(2) },
        { from: ref(1), to: ref(3) },
        { from: ref(2), to: ref(4) },
        { from: ref(3), to: ref(4) },
      ],
    };
    const out = drawn(layoutGraph(g));
    expect(out.nodes).toHaveLength(4); // 4 resolved once, not duplicated
    expect(xOf(out, 1)).toBeLessThan(xOf(out, 2));
    expect(xOf(out, 2)).toBe(xOf(out, 3)); // same layer → same column
    expect(xOf(out, 4)).toBeGreaterThan(xOf(out, 2));
  });

  it('puts a downstream dependent to the right of the root', () => {
    // root 2, dependent 5 waits on it: 2 -> 5.
    const g: GraphView = {
      root: ref(2),
      nodes: [node(2, 'root'), node(5, 'downstream')],
      edges: [{ from: ref(2), to: ref(5) }],
    };
    const out = drawn(layoutGraph(g));
    expect(xOf(out, 5)).toBeGreaterThan(xOf(out, 2));
  });

  it('is deterministic: same input → identical output', () => {
    const g: GraphView = {
      root: ref(3),
      nodes: [node(1), node(2), node(3, 'root')],
      edges: [
        { from: ref(1), to: ref(3) },
        { from: ref(2), to: ref(3) },
      ],
    };
    expect(layoutGraph(g)).toEqual(layoutGraph(g));
  });

  it('flags a graph past the node cap instead of drawing a hairball', () => {
    const nodes = Array.from({ length: MAX_GRAPH_NODES + 1 }, (_, i) => node(i + 1));
    const g: GraphView = { root: ref(1), nodes, edges: [] };
    const out = layoutGraph(g);
    expect(out.tooLarge).toBe(true);
    if (out.tooLarge) expect(out.count).toBe(MAX_GRAPH_NODES + 1);
  });

  it('marks edges out of an unmerged blocker as blocking', () => {
    const blocker: GraphNode = { ...node(1), blocking: true };
    const g: GraphView = {
      root: ref(2),
      nodes: [blocker, node(2, 'root')],
      edges: [{ from: ref(1), to: ref(2) }],
    };
    const out = drawn(layoutGraph(g));
    expect(out.edges[0]?.blocking).toBe(true);
  });
});
