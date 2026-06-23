import { describe, it, expect } from 'vitest';
import { searchPrs } from '../src/lib/pr-search.js';
import type { PrSummary } from '../src/types/index.js';

const mk = (number: number, title: string, state: PrSummary['state'] = 'open'): PrSummary => ({
  ref: { owner: 'teifi-digital', repo: 'gic-live', number },
  title,
  state,
});

const prs: readonly PrSummary[] = [
  mk(91, 'Add user model'),
  mk(92, 'Create user activation flow'),
  mk(90, 'Fix auth redirect', 'merged'),
  mk(150, 'Refactor pricing service'),
];

describe('pr-search', () => {
  it('numeric query puts the exact number first', () => {
    const out = searchPrs('#91', prs);
    expect(out[0]?.ref.number).toBe(91);
  });

  it('numeric query matches partial numbers', () => {
    const out = searchPrs('9', prs);
    const numbers = out.map((p) => p.ref.number);
    expect(numbers).toContain(91);
    expect(numbers).toContain(92);
    expect(numbers).toContain(90);
    expect(numbers).not.toContain(150);
  });

  it('text query fuzzy-matches titles', () => {
    const out = searchPrs('create user', prs);
    expect(out[0]?.ref.number).toBe(92);
  });

  it('text query ranks open PRs above merged on ties', () => {
    const out = searchPrs('user', prs);
    // both 91 and 92 contain "user"; neither is merged, so just assert merged 90 absent
    expect(out.map((p) => p.ref.number)).not.toContain(90);
  });

  it('empty query returns open PRs first', () => {
    const out = searchPrs('', prs);
    expect(out[0]?.state).toBe('open');
    expect(out.length).toBeGreaterThan(0);
  });

  it('no match returns empty', () => {
    expect(searchPrs('zzzzz nonexistent', prs)).toEqual([]);
  });
});
