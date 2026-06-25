import type { GraphError, PrNode, PrRef } from '../types/index.js';
import type { AppError, DepStatus, PrBadgeStatus, PrSummaryWire, Request, ResolveResult, Response } from '../messages.js';
import { type Result, ok, err } from '../lib/result.js';
import { refKey } from '../lib/pr-ref.js';
import { resolveGraph } from '../lib/dependency-graph.js';
import { upsertDeps } from '../lib/deps-codec.js';
import { isAuthError } from '../lib/auth-error.js';
import { loadSettings, saveAuthNeeded } from '../storage.js';
import { buildGraph, fetchPr, listOpenPrs, updatePrBody, verifyToken, type FetchedPr } from '../api/github.js';

// Service worker: owns the token, runs all network + the pure resolver, and
// answers typed messages from content scripts.

const toNode = (pr: FetchedPr): PrNode => ({ ref: pr.ref, state: pr.state, deps: pr.deps });

// Graph-logic problems are the user's to fix (remove a dep). We surface them as
// a non-blocking warning rather than an error that wipes the block.
const graphWarning = (e: GraphError): string => {
  switch (e.kind) {
    case 'cycle':
      return 'Dependency cycle detected — remove one of the dependencies below to break it.';
    case 'depth-exceeded':
      return `Dependency chain is deeper than ${e.maxDepth} levels; not all links were checked.`;
    case 'missing-node':
      return `A referenced PR (#${e.ref.number}) could not be loaded; it may live in a repo the app can't access.`;
  }
};

const dedupeRefs = (refs: readonly PrRef[]): readonly PrRef[] => {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const k = refKey(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const enrich = (
  refs: readonly PrRef[],
  snapshot: ReadonlyMap<string, FetchedPr>,
  blockingKeys: ReadonlySet<string>,
): readonly DepStatus[] =>
  refs.map((ref) => {
    const f = snapshot.get(refKey(ref));
    return {
      ref,
      title: f?.title ?? '',
      state: f?.state ?? 'open',
      blocking: blockingKeys.has(refKey(ref)),
    };
  });

const handleResolve = async (ref: PrRef): Promise<Result<ResolveResult, AppError>> => {
  const settings = await loadSettings();
  if (settings.token === '') return err({ kind: 'no-token' });

  const graph = await buildGraph(settings.token, ref, settings.maxDepth);
  if (!graph.ok) return graph; // infrastructure error (network/http/parse) — show error state

  const snapshot = graph.value;
  const nodes = new Map<string, PrNode>(
    [...snapshot.values()].map((pr) => [refKey(pr.ref), toNode(pr)]),
  );

  const root = snapshot.get(refKey(ref));
  const directRefs = dedupeRefs(root?.deps ?? []);

  // Reverse dependents: open PRs in the SAME repo that declare a dep on this PR.
  // ponytail: same-repo only — scanning every repo for cross-repo dependents
  // isn't feasible without a list of repos to walk. Add that when needed.
  const openPrs = await listOpenPrs(settings.token, ref.owner, ref.repo);
  const dependents: readonly DepStatus[] = openPrs.ok
    ? openPrs.value
        .filter((pr) => pr.deps.some((d) => refKey(d) === refKey(ref)))
        .map((pr) => ({ ref: pr.ref, title: pr.title, state: pr.state, blocking: false }))
    : [];

  const resolved = resolveGraph(ref, nodes, settings.maxDepth);

  // Graph-logic problem (cycle, too deep): fail open. Still show the deps so the
  // user can remove the offending one, warn, and do NOT block the merge.
  if (!resolved.ok) {
    return ok({
      blocked: false,
      direct: enrich(directRefs, snapshot, new Set()),
      transitiveBlocking: [],
      dependents,
      warning: graphWarning(resolved.error),
    });
  }

  const blockingKeys = new Set(resolved.value.blocking.map(refKey));
  return ok({
    blocked: resolved.value.blocked,
    direct: enrich(directRefs, snapshot, blockingKeys),
    transitiveBlocking: enrich(resolved.value.blocking, snapshot, blockingKeys),
    dependents,
    warning: null,
  });
};

const handleSetDeps = async (
  ref: PrRef,
  deps: readonly PrRef[],
): Promise<Result<null, AppError>> => {
  const settings = await loadSettings();
  if (settings.token === '') return err({ kind: 'no-token' });

  const current = await fetchPr(settings.token, ref);
  if (!current.ok) return current;

  return updatePrBody(settings.token, ref, upsertDeps(current.value.body, deps));
};

// Read-modify-write: add one dependency to another PR's body. Powers a "Blocks"
// add — declaring from the current PR that another PR depends on it.
const handleAddDep = async (from: PrRef, dep: PrRef): Promise<Result<null, AppError>> => {
  const settings = await loadSettings();
  if (settings.token === '') return err({ kind: 'no-token' });

  const current = await fetchPr(settings.token, from);
  if (!current.ok) return current;

  const next = dedupeRefs([...current.value.deps, dep]);
  return updatePrBody(settings.token, from, upsertDeps(current.value.body, next));
};

// Read-modify-write: drop one dependency from another PR's body. Used to clear a
// reverse dependent from the upstream PR's page.
const handleRemoveDep = async (from: PrRef, dep: PrRef): Promise<Result<null, AppError>> => {
  const settings = await loadSettings();
  if (settings.token === '') return err({ kind: 'no-token' });

  const current = await fetchPr(settings.token, from);
  if (!current.ok) return current;

  const next = current.value.deps.filter((d) => refKey(d) !== refKey(dep));
  return updatePrBody(settings.token, from, upsertDeps(current.value.body, next));
};

// Build ONE node map for the whole list page: seed it with every open PR (already
// fetched, so free), then fetch only the referenced PRs not already present
// (merged/closed/cross-repo deps), deduped and bounded by depth. This replaces
// the old O(PRs × graph) per-PR BFS with O(open list + unique missing deps).
const buildSharedGraph = async (
  token: string,
  seed: readonly FetchedPr[],
  maxDepth: number,
): Promise<ReadonlyMap<string, PrNode>> => {
  const map = new Map<string, FetchedPr>(seed.map((pr) => [refKey(pr.ref), pr]));
  let frontier = dedupeRefs(seed.flatMap((pr) => pr.deps)).filter((ref) => !map.has(refKey(ref)));
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    const fetched = await Promise.all(frontier.map((ref) => fetchPr(token, ref)));
    fetched.forEach((r) => {
      if (r.ok) map.set(refKey(r.value.ref), r.value);
    });
    frontier = dedupeRefs(fetched.flatMap((r) => (r.ok ? r.value.deps : []))).filter(
      (ref) => !map.has(refKey(ref)),
    );
    depth += 1;
  }

  return new Map([...map.values()].map((pr) => [refKey(pr.ref), toNode(pr)]));
};

const handleListStatuses = async (
  owner: string,
  repo: string,
): Promise<Result<readonly PrBadgeStatus[], AppError>> => {
  const settings = await loadSettings();
  if (settings.token === '') return err({ kind: 'no-token' });

  const allPrs = await listOpenPrs(settings.token, owner, repo);
  if (!allPrs.ok) return allPrs;

  const withDeps = allPrs.value.filter((pr) => pr.deps.length > 0);
  if (withDeps.length === 0) return ok([]);

  const nodes = await buildSharedGraph(settings.token, allPrs.value, settings.maxDepth);

  return ok(
    withDeps.map((pr): PrBadgeStatus => {
      const r = resolveGraph(pr.ref, nodes, settings.maxDepth);
      // A graph problem (cycle / unreachable dep) is fail-open here too: badge it
      // as has-deps-but-not-blocked; the PR page shows the actual warning.
      return { number: pr.ref.number, hasDeps: true, blocked: r.ok ? r.value.blocked : false };
    }),
  );
};

// Reverse an edge: add the new direction first, then remove the old one. If the
// remove fails we roll back the add, so a partial failure never silently *loses*
// the dependency (which would drop merge protection) — worst case it's a no-op.
// blockedBy=true means other ∈ current.deps today → make current ∈ other.deps.
const handleFlipDep = async (
  current: PrRef,
  other: PrRef,
  blockedBy: boolean,
): Promise<Result<null, AppError>> => {
  const removeFrom = blockedBy ? current : other;
  const removeDep = blockedBy ? other : current;
  const addFrom = blockedBy ? other : current;
  const addDep = blockedBy ? current : other;

  const added = await handleAddDep(addFrom, addDep);
  if (!added.ok) return added; // original edge untouched

  const removed = await handleRemoveDep(removeFrom, removeDep);
  if (!removed.ok) {
    await handleRemoveDep(addFrom, addDep); // undo the add to restore the original
    return removed;
  }
  return removed;
};

const handleCheckPr = async (ref: PrRef): Promise<Result<PrSummaryWire, AppError>> => {
  const settings = await loadSettings();
  if (settings.token === '') return err({ kind: 'no-token' });
  const pr = await fetchPr(settings.token, ref);
  if (!pr.ok) return pr;
  return ok({ ref: pr.value.ref, title: pr.value.title, state: pr.value.state });
};

// Toolbar icon as a health signal: a red "!" badge when the token is missing or
// expired, cleared once a call succeeds again. Guarded so we only write storage
// (which the popup watches) on an actual change, avoiding onChanged churn.
let lastAuthNeeded: boolean | null = null;

const setAuthState = (authNeeded: boolean): void => {
  if (lastAuthNeeded === authNeeded) return;
  lastAuthNeeded = authNeeded;
  void chrome.action.setBadgeText({ text: authNeeded ? '!' : '' });
  if (authNeeded) {
    void chrome.action.setBadgeBackgroundColor({ color: '#d1242f' });
    void chrome.action.setTitle({ title: 'MergeChain — GitHub sign-in needed. Click to re-authenticate.' });
  } else {
    void chrome.action.setTitle({ title: 'MergeChain' });
  }
  void saveAuthNeeded(authNeeded);
};

// A successful call proves the token works → clear. An auth error → flag. Any
// other failure (network blip, 404 repo) is inconclusive and leaves the state as
// it was, so a transient hiccup never hides a real "sign-in needed".
const reflectAuth = (res: Response): void => {
  if (res.result.ok) setAuthState(false);
  else if (isAuthError(res.result.error)) setAuthState(true);
};

const handle = async (req: Request): Promise<Response> => {
  switch (req.type) {
    case 'open-options':
      await chrome.runtime.openOptionsPage();
      return { type: 'open-options', result: ok(null) };
    case 'search-prs': {
      const settings = await loadSettings();
      if (settings.token === '') {
        return { type: 'search-prs', result: err({ kind: 'no-token' }) };
      }
      const result = await listOpenPrs(settings.token, req.owner, req.repo);
      return { type: 'search-prs', result };
    }
    case 'resolve':
      return { type: 'resolve', result: await handleResolve(req.ref) };
    case 'set-deps':
      return { type: 'set-deps', result: await handleSetDeps(req.ref, req.deps) };
    case 'add-dep':
      return { type: 'add-dep', result: await handleAddDep(req.from, req.dep) };
    case 'remove-dep':
      return { type: 'remove-dep', result: await handleRemoveDep(req.from, req.dep) };
    case 'flip-dep':
      return { type: 'flip-dep', result: await handleFlipDep(req.current, req.other, req.blockedBy) };
    case 'list-statuses':
      return { type: 'list-statuses', result: await handleListStatuses(req.owner, req.repo) };
    case 'verify-token':
      return { type: 'verify-token', result: await verifyToken(req.token) };
    case 'check-pr':
      return { type: 'check-pr', result: await handleCheckPr(req.ref) };
  }
};

chrome.runtime.onMessage.addListener((req: Request, _sender, sendResponse) => {
  handle(req).then(
    (res) => {
      // open-options does no network work, so it tells us nothing about the token.
      if (req.type !== 'open-options') reflectAuth(res);
      sendResponse(res);
    },
    () => {
      // Any thrown error becomes a typed network error so the content side, which
      // narrows on res.type, always gets a well-formed Response.
      sendResponse({ type: req.type, result: err({ kind: 'network' }) });
    },
  );
  return true; // keep the message channel open for the async response
});
