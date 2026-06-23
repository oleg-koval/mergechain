import type { PrRef } from '../types/index.js';

// Pure parsing / formatting of PR references. No I/O.

/** Stable string key for a ref — used for dedupe, Map keys, cycle detection. */
export const refKey = (ref: PrRef): string =>
  `${ref.owner.toLowerCase()}/${ref.repo.toLowerCase()}#${ref.number}`;

export const refEquals = (a: PrRef, b: PrRef): boolean => refKey(a) === refKey(b);

/** Canonical cross-repo display form: `owner/repo#123`. */
export const formatRef = (ref: PrRef): string => `${ref.owner}/${ref.repo}#${ref.number}`;

/** Canonical github.com URL for a PR. */
export const prUrl = (ref: PrRef): string =>
  `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`;

/**
 * Short display form: bare `#123` when the ref is in the current repo,
 * full `owner/repo#123` otherwise.
 */
export const formatRefShort = (ref: PrRef, current: PrRef): string =>
  ref.owner.toLowerCase() === current.owner.toLowerCase() &&
  ref.repo.toLowerCase() === current.repo.toLowerCase()
    ? `#${ref.number}`
    : formatRef(ref);

const CROSS_REPO = /^([\w.-]+)\/([\w.-]+)#(\d+)$/;
const SAME_REPO = /^#?(\d+)$/;

/**
 * Parse a user-typed reference against the current repo context.
 *   "#91" / "91"            -> current repo, PR 91
 *   "owner/repo#123"        -> cross-repo
 * Returns null when the text is not a complete reference (e.g. mid-typing a title).
 */
export const parseRef = (raw: string, current: PrRef): PrRef | null => {
  const text = raw.trim();

  const cross = CROSS_REPO.exec(text);
  if (cross) {
    const [, owner, repo, num] = cross;
    // The regex guarantees these capture groups exist.
    return { owner: owner ?? '', repo: repo ?? '', number: Number(num) };
  }

  const same = SAME_REPO.exec(text);
  if (same) {
    return { owner: current.owner, repo: current.repo, number: Number(same[1]) };
  }

  return null;
};

/** Parse the owner/repo/number out of a GitHub PR page pathname. */
export const parsePrPath = (pathname: string): PrRef | null => {
  const m = /^\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/.exec(pathname);
  if (!m) return null;
  const [, owner, repo, num] = m;
  return { owner: owner ?? '', repo: repo ?? '', number: Number(num) };
};

/** Parse owner/repo from a GitHub PR list pathname (/{owner}/{repo}/pulls). */
export const parseListPath = (pathname: string): { readonly owner: string; readonly repo: string } | null => {
  const m = /^\/([\w.-]+)\/([\w.-]+)\/pulls\b/.exec(pathname);
  if (!m) return null;
  return { owner: m[1] ?? '', repo: m[2] ?? '' };
};
