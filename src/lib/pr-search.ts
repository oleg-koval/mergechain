import type { PrSummary } from '../types/index.js';

// Pure ranking for the dependency autocomplete. Given what the user typed and a
// list of candidate PRs, return the best matches. Two query modes:
//   - numeric ("#91" / "91")  -> match by PR number
//   - text    ("create user") -> fuzzy match by title

const MAX_RESULTS = 8;

const NUMERIC = /^#?(\d+)$/;

/** Case-insensitive subsequence test: are all chars of `needle` found in order? */
const isSubsequence = (needle: string, haystack: string): boolean =>
  Array.from(haystack).reduce(
    (idx, ch) => (idx < needle.length && needle[idx] === ch ? idx + 1 : idx),
    0,
  ) === needle.length;

/** Open PRs rank above merged/closed when scores are otherwise equal. */
const stateRank = (pr: PrSummary): number => (pr.state === 'open' ? 0 : 1);

const scoreText = (q: string, pr: PrSummary): number => {
  const title = pr.title.toLowerCase();
  const at = title.indexOf(q);
  if (at >= 0) return 1 - at / (title.length + 1); // earlier match = higher
  if (isSubsequence(q, title)) return 0.3;
  return -1;
};

export const searchPrs = (rawQuery: string, prs: readonly PrSummary[]): readonly PrSummary[] => {
  const q = rawQuery.trim().toLowerCase();
  if (q.length === 0) {
    return [...prs].sort((a, b) => stateRank(a) - stateRank(b)).slice(0, MAX_RESULTS);
  }

  const num = NUMERIC.exec(q);
  if (num) {
    const digits = num[1] ?? '';
    return [...prs]
      .filter((pr) => String(pr.ref.number).includes(digits))
      .sort((a, b) => {
        const exactA = String(a.ref.number) === digits ? 0 : 1;
        const exactB = String(b.ref.number) === digits ? 0 : 1;
        return exactA - exactB || a.ref.number - b.ref.number;
      })
      .slice(0, MAX_RESULTS);
  }

  return [...prs]
    .map((pr) => ({ pr, score: scoreText(q, pr) }))
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score || stateRank(a.pr) - stateRank(b.pr))
    .map((s) => s.pr)
    .slice(0, MAX_RESULTS);
};
