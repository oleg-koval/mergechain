// Which repos the add-dependency search should cover. Cross-repo dependencies
// are supported, but the live PR search is per-repo, so to make other repos'
// PRs discoverable we fan the search across the user's configured repos.
//
// Pure: parsing + dedupe + cap only. The network fan-out lives in the worker.

export type RepoId = { readonly owner: string; readonly repo: string };

// Footgun guard: a very large allowedRepos would fan into that many PR-list
// fetches on the first search. The current repo is always first, so it's never
// dropped by the cap.
export const MAX_SEARCH_REPOS = 20;

const repoKey = (r: RepoId): string => `${r.owner.toLowerCase()}/${r.repo.toLowerCase()}`;

// An allowedRepos entry is an `owner/repo` slug; anything malformed is ignored.
const parseRepo = (slug: string): readonly RepoId[] => {
  const m = /^([\w.-]+)\/([\w.-]+)$/.exec(slug.trim());
  return m ? [{ owner: m[1] ?? '', repo: m[2] ?? '' }] : [];
};

/**
 * The repos to search for the add-dependency dropdown: always the current repo,
 * then each configured allowedRepos entry, deduped (case-insensitive), current
 * first, capped at MAX_SEARCH_REPOS. Empty allowedRepos → current repo only.
 */
export const reposToSearch = (
  allowedRepos: readonly string[],
  current: RepoId,
): readonly RepoId[] =>
  allowedRepos
    .flatMap(parseRepo)
    .reduce<readonly RepoId[]>(
      (acc, r) => (acc.some((a) => repoKey(a) === repoKey(r)) ? acc : [...acc, r]),
      [{ owner: current.owner, repo: current.repo }],
    )
    .slice(0, MAX_SEARCH_REPOS);
