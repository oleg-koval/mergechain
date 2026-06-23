// Shared domain types. All readonly — nothing here is mutated.

/** A fully-qualified pointer to a pull request, possibly cross-repo. */
export type PrRef = {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
};

export type PrState = 'open' | 'merged' | 'closed';

/** A PR summary as returned by search / list endpoints. */
export type PrSummary = {
  readonly ref: PrRef;
  readonly title: string;
  readonly state: PrState;
};

/** A node in the dependency graph: a PR plus the PRs it directly depends on. */
export type PrNode = {
  readonly ref: PrRef;
  readonly state: PrState;
  readonly deps: readonly PrRef[];
};

/** Result of walking the transitive dependency graph for a root PR. */
export type ResolvedGraph = {
  /** true if any PR in the transitive closure is not yet merged. */
  readonly blocked: boolean;
  /** Unmerged PRs (open or closed-not-merged) that block the root, in topological order. */
  readonly blocking: readonly PrRef[];
  /** Full transitive closure in a safe merge order (dependencies first). */
  readonly order: readonly PrRef[];
};

export type GraphError =
  | { readonly kind: 'cycle'; readonly cycle: readonly PrRef[] }
  | { readonly kind: 'depth-exceeded'; readonly maxDepth: number }
  | { readonly kind: 'missing-node'; readonly ref: PrRef };

/** Where the dependency block is injected on a PR page. */
export type Placement = 'top' | 'bottom' | 'left' | 'right';

export const PLACEMENTS: readonly Placement[] = ['top', 'bottom', 'left', 'right'];

export const isPlacement = (x: unknown): x is Placement =>
  x === 'top' || x === 'bottom' || x === 'left' || x === 'right';

/** User-configurable settings, persisted in chrome.storage.local. */
export type Settings = {
  readonly token: string;
  /** Repos the extension activates on. Empty = all repos. */
  readonly allowedRepos: readonly string[];
  /** Master toggle for the injected dependency block. */
  readonly showBlock: boolean;
  /** Max depth when walking transitive deps (bounds API calls). */
  readonly maxDepth: number;
  /** Where the block is injected: top of description, bottom (merge box), left gutter, or sidebar. */
  readonly placement: Placement;
};

export const DEFAULT_SETTINGS: Settings = {
  token: '',
  allowedRepos: [],
  showBlock: true,
  maxDepth: 10,
  placement: 'top',
};
