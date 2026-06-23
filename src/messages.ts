import type { PrRef, PrState } from './types/index.js';
import type { Result } from './lib/result.js';

// Typed request/response protocol between the content script and the service
// worker. The service worker is the only place the GitHub token lives, so the
// page context never sees it. All fallible operations cross the boundary as
// Result<_, AppError> — no exceptions traverse messaging.

export type AppError =
  | { readonly kind: 'no-token' }
  | { readonly kind: 'network' }
  | { readonly kind: 'http'; readonly status: number }
  | { readonly kind: 'parse' }
  | { readonly kind: 'codec' }
  | { readonly kind: 'cycle'; readonly cycle: readonly PrRef[] }
  | { readonly kind: 'depth-exceeded'; readonly maxDepth: number }
  | { readonly kind: 'missing-node'; readonly ref: PrRef };

/** A dependency enriched with display info and whether it currently blocks. */
export type DepStatus = {
  readonly ref: PrRef;
  readonly title: string;
  readonly state: PrState;
  readonly blocking: boolean;
};

export type ResolveResult = {
  readonly blocked: boolean;
  /** Directly-declared deps, for the block's list UI. */
  readonly direct: readonly DepStatus[];
  /** Unmerged PRs in the full transitive closure (includes indirect). */
  readonly transitiveBlocking: readonly DepStatus[];
  /** Open PRs (same repo) that declare a dependency on this PR. Informational. */
  readonly dependents: readonly DepStatus[];
  /**
   * A graph problem the user can fix (cycle, chain too deep). When set, the
   * block shows the deps + a warning and does NOT block merge — fail open.
   */
  readonly warning: string | null;
};

export type PrSummaryWire = {
  readonly ref: PrRef;
  readonly title: string;
  readonly state: PrState;
};

/** Per-PR status entry returned for the /pulls list page badges. */
export type PrBadgeStatus = {
  readonly number: number;
  readonly hasDeps: boolean;
  readonly blocked: boolean;
};

/** Identity returned by a successful token check — proves the token reaches GitHub. */
export type TokenIdentity = { readonly login: string; readonly scopes: readonly string[] };

export type Request =
  | { readonly type: 'search-prs'; readonly owner: string; readonly repo: string; readonly query: string }
  | { readonly type: 'resolve'; readonly ref: PrRef }
  | { readonly type: 'set-deps'; readonly ref: PrRef; readonly deps: readonly PrRef[] }
  // Atomically add/drop `dep` in `from`'s declared dependencies (read-modify-write
  // on another PR's body — powers "Blocks" adds and reverse-dependent removal).
  | { readonly type: 'add-dep'; readonly from: PrRef; readonly dep: PrRef }
  | { readonly type: 'remove-dep'; readonly from: PrRef; readonly dep: PrRef }
  // Reverse an existing edge between `current` and `other`. `blockedBy` is the
  // current direction (other ∈ current.deps); flipping makes current ∈ other.deps.
  | { readonly type: 'flip-dep'; readonly current: PrRef; readonly other: PrRef; readonly blockedBy: boolean }
  | { readonly type: 'list-statuses'; readonly owner: string; readonly repo: string }
  | { readonly type: 'verify-token'; readonly token: string }
  // Cheap existence check before persisting a typed ref (catches typos / wrong repo).
  | { readonly type: 'check-pr'; readonly ref: PrRef };

export type Response =
  | { readonly type: 'search-prs'; readonly result: Result<readonly PrSummaryWire[], AppError> }
  | { readonly type: 'resolve'; readonly result: Result<ResolveResult, AppError> }
  | { readonly type: 'set-deps'; readonly result: Result<null, AppError> }
  | { readonly type: 'add-dep'; readonly result: Result<null, AppError> }
  | { readonly type: 'remove-dep'; readonly result: Result<null, AppError> }
  | { readonly type: 'flip-dep'; readonly result: Result<null, AppError> }
  | { readonly type: 'list-statuses'; readonly result: Result<readonly PrBadgeStatus[], AppError> }
  | { readonly type: 'verify-token'; readonly result: Result<TokenIdentity, AppError> }
  | { readonly type: 'check-pr'; readonly result: Result<PrSummaryWire, AppError> };
