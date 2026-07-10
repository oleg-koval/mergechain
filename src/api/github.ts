import type { PrRef, PrState } from '../types/index.js';
import type { AppError } from '../messages.js';
import { type Result, type Err, ok, err } from '../lib/result.js';
import { refKey } from '../lib/pr-ref.js';
import { decodeDeps } from '../lib/deps-codec.js';

// GitHub REST client. The only network boundary. Runs in the service worker so
// the token never enters the page context. Every call returns Result — fetch
// rejections and non-2xx responses become typed errors, never exceptions.

const API = 'https://api.github.com';

/** A PR fetched in full: its state, raw body, and the deps decoded from it. */
export type FetchedPr = {
  readonly ref: PrRef;
  readonly title: string;
  readonly state: PrState;
  readonly body: string;
  readonly deps: readonly PrRef[];
};

const headers = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

const asRecord = (x: unknown): Record<string, unknown> | null =>
  typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : null;

const toState = (rec: Record<string, unknown>): PrState =>
  rec['merged'] === true || typeof rec['merged_at'] === 'string'
    ? 'merged'
    : rec['state'] === 'open'
      ? 'open'
      : 'closed';

const str = (x: unknown): string => (typeof x === 'string' ? x : '');

const getJson = async (url: string, token: string): Promise<Result<unknown, AppError>> => {
  try {
    // no-store: GitHub sends Cache-Control: max-age=60 on authed GETs, so the
    // browser would serve a stale PR list/body for up to a minute after we write.
    // We must read our own writes immediately, so bypass the HTTP cache.
    const res = await fetch(url, { headers: headers(token), cache: 'no-store' });
    if (!res.ok) return err({ kind: 'http', status: res.status });
    return ok((await res.json()) as unknown);
  } catch {
    return err({ kind: 'network' });
  }
};

export const fetchPr = async (
  token: string,
  ref: PrRef,
): Promise<Result<FetchedPr, AppError>> => {
  const json = await getJson(`${API}/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`, token);
  if (!json.ok) return json;

  const rec = asRecord(json.value);
  if (!rec) return err({ kind: 'parse' });

  // A dependency's own body may be malformed; stay lenient and treat it as
  // having no further deps rather than failing the whole graph walk.
  const body = str(rec['body']);
  const decoded = decodeDeps(body);
  const deps = decoded.ok ? decoded.value : [];

  return ok({ ref, title: str(rec['title']), state: toState(rec), body, deps });
};

const toFetchedPr = (owner: string, repo: string, item: unknown): readonly FetchedPr[] => {
  const rec = asRecord(item);
  const number = rec?.['number'];
  if (!rec || typeof number !== 'number') return [];
  const body = str(rec['body']);
  const decoded = decodeDeps(body);
  const deps = decoded.ok ? decoded.value : [];
  return [{ ref: { owner, repo, number }, title: str(rec['title']), state: toState(rec), body, deps }];
};

// Page size for the open-PR list. 100 is GitHub's max per page.
const PAGE_SIZE = 100;
// Safety cap: 10 pages = 1000 open PRs. ponytail: bump if a repo ever exceeds it.
const MAX_PAGES = 10;

export const listOpenPrs = async (
  token: string,
  owner: string,
  repo: string,
): Promise<Result<readonly FetchedPr[], AppError>> => {
  const all: FetchedPr[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const json = await getJson(
      `${API}/repos/${owner}/${repo}/pulls?state=open&per_page=${PAGE_SIZE}&page=${page}`,
      token,
    );
    if (!json.ok) return json;
    if (!Array.isArray(json.value)) return err({ kind: 'parse' });

    const items = json.value as readonly unknown[];
    all.push(...items.flatMap((item) => toFetchedPr(owner, repo, item)));
    if (items.length < PAGE_SIZE) break; // last page reached
    page += 1;
  }

  return ok(all);
};

/**
 * Verify a token by calling GET /user. Returns the authenticated login and the
 * token's granted scopes (from the `x-oauth-scopes` header). Used by the
 * settings page to prove the token works and reaches only GitHub.
 */
export const verifyToken = async (
  token: string,
): Promise<Result<{ readonly login: string; readonly scopes: readonly string[] }, AppError>> => {
  try {
    const res = await fetch(`${API}/user`, { headers: headers(token), cache: 'no-store' });
    if (!res.ok) return err({ kind: 'http', status: res.status });
    const rec = asRecord((await res.json()) as unknown);
    if (!rec) return err({ kind: 'parse' });
    const scopeHeader = res.headers.get('x-oauth-scopes') ?? '';
    const scopes = scopeHeader
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return ok({ login: str(rec['login']), scopes });
  } catch {
    return err({ kind: 'network' });
  }
};

export const updatePrBody = async (
  token: string,
  ref: PrRef,
  body: string,
): Promise<Result<null, AppError>> => {
  try {
    const res = await fetch(`${API}/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`, {
      method: 'PATCH',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) return err({ kind: 'http', status: res.status });
    return ok(null);
  } catch {
    return err({ kind: 'network' });
  }
};

/**
 * Breadth-first walk of the dependency graph starting at `root`, fetching each
 * reachable PR once, bounded by `maxDepth`. Returns a snapshot the pure
 * resolver can reason over. Effectful (network + mutable queue) by necessity;
 * the cycle/order logic stays in the pure layer.
 */
export const buildGraph = async (
  token: string,
  root: PrRef,
  maxDepth: number,
): Promise<Result<ReadonlyMap<string, FetchedPr>, AppError>> => {
  // The root must load — if it 404s/errors there's nothing to resolve.
  const rootPr = await fetchPr(token, root);
  if (!rootPr.ok) return rootPr;

  const nodes = new Map<string, FetchedPr>([[refKey(root), rootPr.value]]);
  let frontier: readonly PrRef[] = rootPr.value.deps.filter((ref) => !nodes.has(refKey(ref)));
  let depth = 1;

  while (frontier.length > 0 && depth <= maxDepth) {
    const fetched = await Promise.all(
      frontier
        .filter((ref) => !nodes.has(refKey(ref)))
        .map((ref) => fetchPr(token, ref)),
    );
    // A transient/unexpected error (network, parse) fails the whole walk. But an
    // HTTP error on a *dependency* (404 deleted/private, 403 app not installed on
    // a cross-repo PR) is non-fatal: skip that node so the pure resolver reports
    // it as a non-blocking `missing-node` warning instead of wiping the block.
    const transient = fetched.find((r): r is Err<AppError> => !r.ok && r.error.kind !== 'http');
    if (transient) return transient;

    const pulled = fetched.flatMap((r) => (r.ok ? [r.value] : []));
    pulled.forEach((pr) => nodes.set(refKey(pr.ref), pr));

    frontier = pulled
      .flatMap((pr) => pr.deps)
      .filter((ref) => !nodes.has(refKey(ref)));
    depth += 1;
  }

  return ok(nodes);
};
