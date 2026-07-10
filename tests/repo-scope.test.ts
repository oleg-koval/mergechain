import { describe, it, expect } from 'vitest';
import { reposToSearch, MAX_SEARCH_REPOS, type RepoId } from '../src/lib/repo-scope.js';

const current: RepoId = { owner: 'oleg-koval', repo: 'pr-deps' };

describe('reposToSearch', () => {
  it('returns just the current repo when allowedRepos is empty', () => {
    expect(reposToSearch([], current)).toEqual([current]);
  });

  it('adds configured repos after the current one, current first', () => {
    const out = reposToSearch(['acme/api', 'acme/web'], current);
    expect(out).toEqual([current, { owner: 'acme', repo: 'api' }, { owner: 'acme', repo: 'web' }]);
  });

  it('dedupes the current repo (case-insensitive) if it also appears in allowedRepos', () => {
    const out = reposToSearch(['Oleg-Koval/PR-Deps', 'acme/api'], current);
    expect(out).toEqual([current, { owner: 'acme', repo: 'api' }]);
  });

  it('ignores malformed entries', () => {
    const out = reposToSearch(['not-a-repo', '', 'acme/api', 'a/b/c'], current);
    expect(out).toEqual([current, { owner: 'acme', repo: 'api' }]);
  });

  it('caps the fan-out but never drops the current repo', () => {
    const many = Array.from({ length: MAX_SEARCH_REPOS + 5 }, (_, i) => `acme/repo${String(i)}`);
    const out = reposToSearch(many, current);
    expect(out).toHaveLength(MAX_SEARCH_REPOS);
    expect(out[0]).toEqual(current);
  });
});
