import type { GraphEdge, GraphNode, GraphView } from '../messages.js';
import type { PrRef } from '../types/index.js';
import { refKey } from './pr-ref.js';

// Pure layout for the dependency Graph view. Given the neighborhood graph
// (upstream deps + root + downstream dependents), compute a deterministic
// left-to-right layered layout: dependencies sit left of the PRs that need
// them, so the picture reads in merge order.
//
// Held to the strict pure-core FP rules (no let/loops/mutation/throw/classes) —
// layering is memoized recursion in the same style as dependency-graph.ts.

/** Above this many nodes we don't attempt a diagram — the caller shows the list. */
export const MAX_GRAPH_NODES = 40;

// Geometry. A node is a compact pill; columns are layers, rows stack within a
// layer. Gap-x leaves room for the edge + arrowhead between columns.
const NODE_W = 168;
const NODE_H = 32;
const GAP_X = 48;
const GAP_Y = 14;
const PAD = 8;

export type LaidNode = {
  readonly node: GraphNode;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type LaidEdge = {
  readonly from: PrRef;
  readonly to: PrRef;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  /** The prerequisite (`from`) is an unmerged blocker — draw in the danger color. */
  readonly blocking: boolean;
};

export type LaidOutGraph =
  | { readonly tooLarge: true; readonly count: number }
  | {
      readonly tooLarge: false;
      readonly width: number;
      readonly height: number;
      readonly nodes: readonly LaidNode[];
      readonly edges: readonly LaidEdge[];
    };

// Predecessors of a node: the PRs that must merge before it (edge.from → edge.to
// means `from` merges first, so `from` is a predecessor of `to`). Only edges
// whose both endpoints are real nodes are kept.
const buildPreds = (
  edges: readonly GraphEdge[],
  present: ReadonlySet<string>,
): ReadonlyMap<string, readonly string[]> =>
  edges.reduce<ReadonlyMap<string, readonly string[]>>((acc, e) => {
    const toK = refKey(e.to);
    const fromK = refKey(e.from);
    if (!present.has(toK) || !present.has(fromK)) return acc;
    const prev = acc.get(toK) ?? [];
    return new Map(acc).set(toK, [...prev, fromK]);
  }, new Map());

type LayerAcc = { readonly layer: number; readonly memo: ReadonlyMap<string, number> };

// Longest-path layer of a node = 0 when it has no predecessor, else
// 1 + max(layer of predecessors). Memoized; a cycle back-edge contributes 0 so
// a malformed (cyclic) graph still lays out instead of recursing forever.
const layerOf = (
  key: string,
  preds: ReadonlyMap<string, readonly string[]>,
  memo: ReadonlyMap<string, number>,
  visiting: ReadonlySet<string>,
): LayerAcc => {
  const cached = memo.get(key);
  if (cached !== undefined) return { layer: cached, memo };
  if (visiting.has(key)) return { layer: 0, memo }; // cycle: break without recursing

  const ps = preds.get(key) ?? [];
  const nextVisiting = new Set([...visiting, key]);
  const folded = ps.reduce<{ readonly max: number; readonly memo: ReadonlyMap<string, number> }>(
    (acc, p) => {
      const r = layerOf(p, preds, acc.memo, nextVisiting);
      return { max: Math.max(acc.max, r.layer), memo: r.memo };
    },
    { max: -1, memo },
  );

  const layer = ps.length === 0 ? 0 : folded.max + 1;
  return { layer, memo: new Map(folded.memo).set(key, layer) };
};

// Layer for every node, threaded through one shared memo.
const allLayers = (
  keys: readonly string[],
  preds: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, number> =>
  keys.reduce<ReadonlyMap<string, number>>((memo, key) => layerOf(key, preds, memo, new Set()).memo, new Map());

// Place each node: x by its layer (column), y by its running index within that
// layer (row). Rows are ordered by node input order — deterministic given the
// input, no in-place sort (which the pure-core rules forbid).
type PlaceAcc = { readonly counts: ReadonlyMap<number, number>; readonly laid: readonly LaidNode[] };

const placeNodes = (
  nodes: readonly GraphNode[],
  layers: ReadonlyMap<string, number>,
): readonly LaidNode[] =>
  nodes.reduce<PlaceAcc>(
    (acc, node) => {
      const layer = layers.get(refKey(node.ref)) ?? 0;
      const row = acc.counts.get(layer) ?? 0;
      const laidNode: LaidNode = {
        node,
        x: PAD + layer * (NODE_W + GAP_X),
        y: PAD + row * (NODE_H + GAP_Y),
        w: NODE_W,
        h: NODE_H,
      };
      return {
        counts: new Map(acc.counts).set(layer, row + 1),
        laid: [...acc.laid, laidNode],
      };
    },
    { counts: new Map(), laid: [] },
  ).laid;

const placeEdges = (
  edges: readonly GraphEdge[],
  byKey: ReadonlyMap<string, LaidNode>,
): readonly LaidEdge[] =>
  edges.flatMap((e) => {
    const from = byKey.get(refKey(e.from));
    const to = byKey.get(refKey(e.to));
    if (!from || !to) return [];
    return [
      {
        from: e.from,
        to: e.to,
        x1: from.x + from.w,
        y1: from.y + from.h / 2,
        x2: to.x,
        y2: to.y + to.h / 2,
        blocking: from.node.blocking,
      },
    ];
  });

export const layoutGraph = (graph: GraphView): LaidOutGraph => {
  if (graph.nodes.length > MAX_GRAPH_NODES) {
    return { tooLarge: true, count: graph.nodes.length };
  }

  const present = new Set(graph.nodes.map((n) => refKey(n.ref)));
  const preds = buildPreds(graph.edges, present);
  const layers = allLayers([...present], preds);
  const laid = placeNodes(graph.nodes, layers);
  const byKey = new Map(laid.map((n) => [refKey(n.node.ref), n]));
  const laidEdges = placeEdges(graph.edges, byKey);

  const right = laid.reduce((m, n) => Math.max(m, n.x + n.w), 0);
  const bottom = laid.reduce((m, n) => Math.max(m, n.y + n.h), 0);

  return {
    tooLarge: false,
    width: laid.length === 0 ? 0 : right + PAD,
    height: laid.length === 0 ? 0 : bottom + PAD,
    nodes: laid,
    edges: laidEdges,
  };
};
