import type { Placement, PrRef, Settings } from '../types/index.js';
import type { AppError, PrBadgeStatus, PrSummaryWire, Request, Response } from '../messages.js';
import { DEFAULT_SETTINGS, isPlacement } from '../types/index.js';
import { parsePrPath, parseListPath, refEquals, formatRefShort } from '../lib/pr-ref.js';
import { searchPrs } from '../lib/pr-search.js';
import { authPrompt } from '../lib/auth-error.js';
import { err } from '../lib/result.js';
import { loadSettings } from '../storage.js';
import { createDependencyBlock, type BlockCallbacks, type BlockState } from '../components/dependency-block.js';
import { injectStyles, mountBlock, setMergeBlocked, findMergeArea, blockExists, injectListBadge, removeBlock, setBusy } from './dom.js';

// Content-script orchestration. Holds the small amount of UI state, talks to
// the service worker over the typed message protocol, and keeps the injected
// block in sync as GitHub re-renders its SPA.

// Never throws: if the extension was reloaded (the SW context is invalidated),
// chrome.runtime.sendMessage rejects — turn that into a typed network error so
// callers always get a Response and the UI never hangs / leaks a busy state.
const send = async (req: Request): Promise<Response> => {
  try {
    return await chrome.runtime.sendMessage(req);
  } catch {
    return { type: req.type, result: err({ kind: 'network' }) };
  }
};

const debounce = (fn: () => void, ms: number): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
};

const errorMessage = (e: AppError): string => {
  switch (e.kind) {
    case 'no-token':
      return 'Add a GitHub token in the extension settings to enable dependencies.';
    case 'network':
      return 'Could not reach GitHub. Check your connection.';
    case 'http':
      // 404/403 on the PR itself almost always means the GitHub App isn't
      // installed on this (private) repo, or the token lacks access.
      if (e.status === 404 || e.status === 403) {
        return "Can't access this repository. If it's private, ask an org owner to install this extension's GitHub App on it (Org Settings → GitHub Apps), or use a token with access to this repo.";
      }
      if (e.status === 401) {
        return 'Your GitHub sign-in is invalid or expired. Re-authenticate in the extension settings.';
      }
      return `GitHub returned an error (HTTP ${String(e.status)}).`;
    case 'parse':
      return 'Unexpected response from GitHub.';
    case 'codec':
      return 'The dependency data on this PR is malformed.';
    case 'cycle':
      return 'Dependency cycle detected — a PR cannot depend on itself.';
    case 'depth-exceeded':
      return `Dependency chain is deeper than ${String(e.maxDepth)} levels.`;
    case 'missing-node':
      return `A referenced PR could not be loaded (#${String(e.ref.number)}).`;
  }
};

// Module-level UI state. Boundary code, so mutation is allowed and intended.
let current: PrRef | null = null;
let lastPath = '';
let currentDeps: readonly PrRef[] = [];
let lastBlocked: { readonly blocked: boolean; readonly reason: string } = {
  blocked: false,
  reason: '',
};
let openPrsCache: readonly PrSummaryWire[] | null = null;
let currentPlacement: Placement = DEFAULT_SETTINGS.placement;
let lastState: BlockState | null = null;

// List-page state
let listCtx: { readonly owner: string; readonly repo: string } | null = null;
let listStatuses: readonly PrBadgeStatus[] = [];
let listFetching = false;

const getOpenPrs = async (ref: PrRef): Promise<readonly PrSummaryWire[]> => {
  if (openPrsCache) return openPrsCache;
  const res = await send({ type: 'search-prs', owner: ref.owner, repo: ref.repo, query: '' });
  openPrsCache = res.type === 'search-prs' && res.result.ok ? res.result.value : [];
  return openPrsCache;
};

const callbacks = (ref: PrRef): BlockCallbacks => ({
  onSearch: async (query) => searchPrs(query, await getOpenPrs(ref)),
  onAdd: (dep) => {
    if (refEquals(dep, ref)) return; // a PR can't depend on itself
    if (currentDeps.some((d) => refEquals(d, dep))) return;
    void addDependency(ref, dep);
  },
  onAddBlocks: (target) => {
    if (refEquals(target, ref)) return; // a PR can't block itself
    void addBlocks(ref, target);
  },
  onRemove: (dep) => {
    // Removing from this PR's own body — low risk, no confirmation.
    void mutate(ref, currentDeps.filter((d) => !refEquals(d, dep)));
  },
  onRemoveDependent: (dependent) => {
    // The block confirms inline before calling this (it edits the other PR).
    void removeDependent(ref, dependent);
  },
  onFlip: (other, blockedBy) => {
    // The block confirms inline before calling this (it rewrites both PRs).
    void flipDirection(ref, other, blockedBy);
  },
  onSignIn: () => {
    // Content scripts can't open the options page directly — ask the worker.
    void send({ type: 'open-options' });
  },
});

const render = (ref: PrRef, state: BlockState): void => {
  lastState = state;
  mountBlock(createDependencyBlock(ref, state, callbacks(ref)), currentPlacement);
};

// A failed operation becomes a sign-in CTA when the token is missing/expired,
// otherwise a plain error line. `prefix` adds context (e.g. "Could not add #5:")
// to non-auth errors only — the auth CTA stands on its own.
const renderFailure = (ref: PrRef, e: AppError, prefix = ''): void => {
  const prompt = authPrompt(e);
  if (prompt) render(ref, { kind: 'auth', message: prompt.message, action: prompt.action });
  else render(ref, { kind: 'error', message: `${prefix}${errorMessage(e)}` });
};

const blockReason = (firstBlocking: PrRef | undefined, ref: PrRef): string =>
  firstBlocking
    ? `Blocked: ${formatRefShort(firstBlocking, ref)} must be merged first`
    : 'Blocked by an unmerged dependency';

const refresh = async (ref: PrRef): Promise<void> => {
  const res = await send({ type: 'resolve', ref });
  if (res.type !== 'resolve') return;
  if (!res.result.ok) {
    renderFailure(ref, res.result.error);
    lastBlocked = { blocked: false, reason: '' };
    setMergeBlocked(false, '');
    return;
  }
  const result = res.result.value;
  currentDeps = result.direct.map((d) => d.ref);
  render(ref, { kind: 'ready', result });
  lastBlocked = {
    blocked: result.blocked,
    reason: blockReason(result.transitiveBlocking[0]?.ref, ref),
  };
  setMergeBlocked(lastBlocked.blocked, lastBlocked.reason);
};

const mutate = async (ref: PrRef, next: readonly PrRef[]): Promise<void> => {
  setBusy(true);
  const res = await send({ type: 'set-deps', ref, deps: next });
  if (res.type === 'set-deps' && !res.result.ok) {
    renderFailure(ref, res.result.error);
    return;
  }
  await refresh(ref);
};

// "Blocked by": validate the target exists before writing it into this PR's body
// (set-deps only fetches the current PR, so a typo'd ref would persist silently).
const addDependency = async (ref: PrRef, dep: PrRef): Promise<void> => {
  setBusy(true);
  const check = await send({ type: 'check-pr', ref: dep });
  if (check.type === 'check-pr' && !check.result.ok) {
    renderFailure(ref, check.result.error, `Could not add ${formatRefShort(dep, ref)}: `);
    return;
  }
  await mutate(ref, [...currentDeps, dep]);
};

// "Blocks": declare that `target` depends on this PR by adding us to its deps.
const addBlocks = async (ref: PrRef, target: PrRef): Promise<void> => {
  setBusy(true);
  const res = await send({ type: 'add-dep', from: target, dep: ref });
  if (res.type === 'add-dep' && !res.result.ok) {
    renderFailure(ref, res.result.error);
    return;
  }
  await refresh(ref);
};

// Reverse an existing edge between this PR and `other`.
const flipDirection = async (ref: PrRef, other: PrRef, blockedBy: boolean): Promise<void> => {
  setBusy(true);
  const res = await send({ type: 'flip-dep', current: ref, other, blockedBy });
  if (res.type === 'flip-dep' && !res.result.ok) {
    renderFailure(ref, res.result.error);
    return;
  }
  await refresh(ref);
};

// Clear a reverse dependent: edit the dependent PR's body to drop its dep on us.
const removeDependent = async (ref: PrRef, dependent: PrRef): Promise<void> => {
  setBusy(true);
  const res = await send({ type: 'remove-dep', from: dependent, dep: ref });
  if (res.type === 'remove-dep' && !res.result.ok) {
    renderFailure(ref, res.result.error);
    return;
  }
  await refresh(ref);
};

// Tear down all per-PR state and remove the block. Called whenever we leave a
// PR we were managing, so stale state can't drive the wrong PR's UI (e.g.
// re-disabling a merge button using a previous PR's blocked status).
const resetPrState = (): void => {
  current = null;
  lastState = null;
  currentDeps = [];
  lastBlocked = { blocked: false, reason: '' };
  removeBlock();
};

const init = async (): Promise<void> => {
  const ref = parsePrPath(location.pathname);
  if (!ref) {
    if (current) resetPrState();
    return;
  }

  const settings = await loadSettings();
  if (!settings.showBlock) {
    if (current) resetPrState();
    return;
  }
  currentPlacement = settings.placement;
  const slug = `${ref.owner}/${ref.repo}`;
  if (settings.allowedRepos.length > 0 && !settings.allowedRepos.includes(slug)) {
    if (current) resetPrState();
    return;
  }
  // Navigated to a different PR — drop the previous PR's state before we render.
  if (current && !refEquals(current, ref)) resetPrState();
  if (!findMergeArea()) return;

  // New PR page since last init → reset per-PR caches.
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    openPrsCache = null;
    currentDeps = [];
  }

  current = ref;
  injectStyles();
  render(ref, { kind: 'loading' });
  await refresh(ref);
};

/** Walk PR title links on the list page and inject status badges. Cheap — no I/O. */
const injectBadges = (ctx: { readonly owner: string; readonly repo: string }): void => {
  if (listStatuses.length === 0) return;
  const statusMap = new Map(listStatuses.map((s) => [s.number, s]));
  const seen = new Set<number>();
  const pattern = new RegExp(`^/${ctx.owner}/${ctx.repo}/pull/(\\d+)$`, 'i');
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    const m = pattern.exec(link.getAttribute('href') ?? '');
    if (!m) return;
    const n = Number(m[1]);
    if (seen.has(n)) return;
    seen.add(n);
    const status = statusMap.get(n);
    if (status) {
      injectStyles();
      injectListBadge(link, status.blocked);
    }
  });
};

const initList = async (): Promise<void> => {
  const ctx = parseListPath(location.pathname);
  if (!ctx) return;

  const settings = await loadSettings();
  if (!settings.showBlock) return;
  const slug = `${ctx.owner}/${ctx.repo}`;
  if (settings.allowedRepos.length > 0 && !settings.allowedRepos.includes(slug)) return;

  const needsFetch = !listCtx || listCtx.owner !== ctx.owner || listCtx.repo !== ctx.repo;
  if (needsFetch) {
    if (listFetching) return; // another fetch is already in progress
    listFetching = true;
    listCtx = ctx;
    listStatuses = [];
    try {
      const res = await send({ type: 'list-statuses', owner: ctx.owner, repo: ctx.repo });
      if (res.type === 'list-statuses' && res.result.ok) listStatuses = res.result.value;
    } finally {
      listFetching = false; // never wedge the flag, even if something throws
    }
  }

  injectBadges(ctx);
};

// GitHub is a Turbo SPA: it swaps the merge box in and out and re-renders it
// after our edits. Re-apply the block state and remount when our block vanishes.
const reconcile = debounce(() => {
  if (current && lastBlocked.blocked) setMergeBlocked(true, lastBlocked.reason);
  if (findMergeArea() && !blockExists()) void init();
  void initList(); // handles both SPA nav to /pulls and re-injecting after DOM churn
}, 300);

new MutationObserver(reconcile).observe(document.body, { childList: true, subtree: true });

// React live to settings changes (popup quick-switch or Options page). Placement
// changes just move the existing block; showBlock off removes it; a token change
// (or any non-ready state) re-fetches so fixing sign-in recovers the open PR
// immediately instead of leaving the stale CTA up; anything else re-renders.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes['settings']) return;
  const next = changes['settings'].newValue as Settings | undefined;
  const prev = changes['settings'].oldValue as Settings | undefined;
  if (!next) return;
  if (!next.showBlock) {
    removeBlock();
    return;
  }
  if (isPlacement(next.placement)) currentPlacement = next.placement;
  // The resolve result depends on the token; re-fetch when it changes, or when
  // the block is showing a recoverable state (auth/error) that may now clear.
  if (current && (!prev || prev.token !== next.token || (lastState !== null && lastState.kind !== 'ready'))) {
    void refresh(current);
    return;
  }
  if (current && lastState) render(current, lastState);
  else void init();
});

void init();
void initList();
