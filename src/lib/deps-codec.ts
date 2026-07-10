import type { PrRef } from '../types/index.js';
import { type Result, ok, err } from './result.js';

// Encode/decode the dependency list as a hidden HTML comment embedded in a PR
// body. This is the storage layer: no backend, the data lives in the PR forever
// and is readable by anyone (with or without the extension).
//
// Wire format (single line):
//   <!-- pr-merge-deps:{"v":1,"deps":[{"owner":"o","repo":"r","number":91}]} -->

const PREFIX = 'pr-merge-deps:';
const MARKER = /<!--\s*pr-merge-deps:(.*?)\s*-->/s;
const SCHEMA_VERSION = 1;

export type CodecError =
  | { readonly kind: 'invalid-json' }
  | { readonly kind: 'invalid-shape' };

const isPrRef = (x: unknown): x is PrRef => {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o['owner'] === 'string' &&
    typeof o['repo'] === 'string' &&
    typeof o['number'] === 'number' &&
    Number.isInteger(o['number'])
  );
};

const safeParse = (json: string): Result<unknown, CodecError> => {
  try {
    return ok(JSON.parse(json));
  } catch {
    return err({ kind: 'invalid-json' });
  }
};

/** Build the hidden-comment line for a set of deps (deduplicates by ref key). */
export const encodeDeps = (deps: readonly PrRef[]): string => {
  const seenKeys = new Set<string>();
  const unique = deps.filter((d) => {
    const k = `${d.owner.toLowerCase()}/${d.repo.toLowerCase()}#${d.number}`;
    if (seenKeys.has(k)) return false;
    seenKeys.add(k);
    return true;
  });
  const normalized = unique.map((d) => ({ owner: d.owner, repo: d.repo, number: d.number }));
  return `<!-- ${PREFIX}${JSON.stringify({ v: SCHEMA_VERSION, deps: normalized })} -->`;
};

/**
 * Extract the dependency list from a PR body. A body with no marker is valid
 * and yields an empty list. A malformed marker is an error so we never silently
 * drop a user's declared dependencies.
 */
export const decodeDeps = (body: string): Result<readonly PrRef[], CodecError> => {
  const match = MARKER.exec(body);
  if (!match || match[1] === undefined) return ok([]);

  const parsed = safeParse(match[1]);
  if (!parsed.ok) return parsed;

  const data = parsed.value;
  if (typeof data !== 'object' || data === null) return err({ kind: 'invalid-shape' });

  const deps = (data as Record<string, unknown>)['deps'];
  if (!Array.isArray(deps) || !deps.every(isPrRef)) return err({ kind: 'invalid-shape' });

  return ok(deps);
};

/** Strip the hidden marker so the body can be shown to humans cleanly. */
export const stripDeps = (body: string): string => body.replace(MARKER, '').replace(/\n{3,}/g, '\n\n').trim();

/**
 * Insert or replace the dependency marker in a PR body. Empty deps removes the
 * marker entirely. The marker is kept on its own trailing line.
 */
export const upsertDeps = (body: string, deps: readonly PrRef[]): string => {
  const clean = stripDeps(body);
  if (deps.length === 0) return clean;
  return clean.length === 0 ? encodeDeps(deps) : `${clean}\n\n${encodeDeps(deps)}`;
};
