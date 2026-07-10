import type { GraphError, PrNode, PrRef, ResolvedGraph } from '../types/index.js';
import { type Result, ok, err, map } from './result.js';
import { refKey } from './pr-ref.js';

// Resolve the transitive dependency closure of a root PR.
//
// GitLab deliberately refuses transitive deps (A -> B -> C); we support them.
// That makes three things mandatory:
//   1. cycle detection  — A -> B -> A must error, not loop forever
//   2. a depth cap       — bounds the number of API calls the boundary makes
//   3. diamond dedupe    — A -> B, A -> C, B -> D, C -> D resolves D once
//
// This function is pure: the caller pre-fetches every reachable PR into `nodes`
// (a BFS in the effectful boundary, also depth-capped) and we compute order +
// blocking status over that immutable snapshot.

type Acc = {
  readonly order: readonly PrRef[];
  readonly seen: ReadonlySet<string>;
};

const isMerged = (nodes: ReadonlyMap<string, PrNode>, ref: PrRef): boolean =>
  nodes.get(refKey(ref))?.state === 'merged';

const visit = (
  ref: PrRef,
  nodes: ReadonlyMap<string, PrNode>,
  path: readonly string[],
  depth: number,
  maxDepth: number,
  acc: Acc,
): Result<Acc, GraphError> => {
  if (depth > maxDepth) return err({ kind: 'depth-exceeded', maxDepth });

  const key = refKey(ref);
  if (acc.seen.has(key)) return ok(acc); // diamond: already resolved

  const cycleAt = path.indexOf(key);
  if (cycleAt >= 0) {
    const cycle = [...path.slice(cycleAt), key].map(keyToRef);
    return err({ kind: 'cycle', cycle });
  }

  const node = nodes.get(key);
  if (!node) return err({ kind: 'missing-node', ref });

  // Post-order: resolve every dependency before recording this node, so the
  // returned order lists dependencies before the PRs that need them.
  const childResult = node.deps.reduce<Result<Acc, GraphError>>(
    (accR, dep) =>
      accR.ok ? visit(dep, nodes, [...path, key], depth + 1, maxDepth, accR.value) : accR,
    ok(acc),
  );

  return map(childResult, (child) => ({
    order: [...child.order, ref],
    seen: new Set([...child.seen, key]),
  }));
};

// Reverse of refKey for building a readable cycle path. Only used on keys we
// produced ourselves, so the shape is known.
const keyToRef = (key: string): PrRef => {
  const m = /^(.+)\/(.+)#(\d+)$/.exec(key);
  return {
    owner: m?.[1] ?? '',
    repo: m?.[2] ?? '',
    number: Number(m?.[3] ?? 0),
  };
};

export const resolveGraph = (
  root: PrRef,
  nodes: ReadonlyMap<string, PrNode>,
  maxDepth: number,
): Result<ResolvedGraph, GraphError> => {
  const rootNode = nodes.get(refKey(root));
  if (!rootNode) return err({ kind: 'missing-node', ref: root });

  const rootKey = refKey(root);
  const resolved = rootNode.deps.reduce<Result<Acc, GraphError>>(
    (accR, dep) =>
      accR.ok ? visit(dep, nodes, [rootKey], 1, maxDepth, accR.value) : accR,
    ok<Acc>({ order: [], seen: new Set() }),
  );

  return map(resolved, (acc) => {
    const blocking = acc.order.filter((ref) => !isMerged(nodes, ref));
    return { blocked: blocking.length > 0, blocking, order: acc.order };
  });
};
