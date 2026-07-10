import { describe, it, expect } from 'vitest';
import {
  refKey,
  refEquals,
  formatRef,
  formatRefShort,
  parseRef,
  parsePrPath,
  parseListPath,
} from '../src/lib/pr-ref.js';
import type { PrRef } from '../src/types/index.js';

const current: PrRef = { owner: 'teifi-digital', repo: 'gic-live', number: 1 };

describe('pr-ref', () => {
  it('refKey is case-insensitive and stable', () => {
    expect(refKey({ owner: 'Teifi', repo: 'GIC', number: 9 })).toBe('teifi/gic#9');
    expect(refEquals({ owner: 'A', repo: 'b', number: 2 }, { owner: 'a', repo: 'B', number: 2 })).toBe(
      true,
    );
  });

  it('formatRef is the full cross-repo form', () => {
    expect(formatRef({ owner: 'o', repo: 'r', number: 5 })).toBe('o/r#5');
  });

  it('formatRefShort drops owner/repo only for same-repo refs', () => {
    expect(formatRefShort({ owner: 'teifi-digital', repo: 'gic-live', number: 91 }, current)).toBe(
      '#91',
    );
    expect(formatRefShort({ owner: 'teifi-digital', repo: 'other', number: 12 }, current)).toBe(
      'teifi-digital/other#12',
    );
  });

  it('parseRef handles same-repo numeric forms', () => {
    expect(parseRef('#91', current)).toEqual({ ...current, number: 91 });
    expect(parseRef('91', current)).toEqual({ ...current, number: 91 });
    expect(parseRef('  42 ', current)).toEqual({ ...current, number: 42 });
  });

  it('parseRef handles cross-repo form', () => {
    expect(parseRef('teifi-digital/other-repo#123', current)).toEqual({
      owner: 'teifi-digital',
      repo: 'other-repo',
      number: 123,
    });
  });

  it('parseRef returns null for incomplete / title text', () => {
    expect(parseRef('Create user', current)).toBeNull();
    expect(parseRef('teifi-digital/other-repo', current)).toBeNull();
    expect(parseRef('', current)).toBeNull();
  });

  it('parsePrPath extracts ref from a PR URL path', () => {
    expect(parsePrPath('/teifi-digital/gic-live/pull/97/files')).toEqual({
      owner: 'teifi-digital',
      repo: 'gic-live',
      number: 97,
    });
    expect(parsePrPath('/teifi-digital/gic-live/issues/97')).toBeNull();
    expect(parsePrPath('/settings')).toBeNull();
  });

  it('parseListPath extracts owner/repo from a /pulls URL', () => {
    expect(parseListPath('/teifi-digital/gic-live/pulls')).toEqual({
      owner: 'teifi-digital',
      repo: 'gic-live',
    });
    expect(parseListPath('/teifi-digital/gic-live/pulls?q=is%3Aopen')).toEqual({
      owner: 'teifi-digital',
      repo: 'gic-live',
    });
    expect(parseListPath('/teifi-digital/gic-live/pull/97')).toBeNull();
    expect(parseListPath('/pulls')).toBeNull();
  });
});
