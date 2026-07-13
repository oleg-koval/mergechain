import type { PrRef } from '../types/index.js';
import { type Result, ok, err } from './result.js';

// Encode/decode the dependency list as a managed section embedded in a PR body.
// The visible Markdown keeps the relationship useful without the extension;
// the hidden marker remains the machine-readable source of truth.
//
// Wire format (single line):
//   <!-- pr-merge-deps:{"v":1,"deps":[{"owner":"o","repo":"r","number":91}]} -->

const PREFIX = 'pr-merge-deps:';
const MARKER = /<!--\s*pr-merge-deps:(.*?)\s*-->/s;
const ALL_MARKERS = /<!--\s*pr-merge-deps:(.*?)\s*-->/gs;
const MANAGED_SECTION = /<!--\s*mergechain-deps:start\s*-->.*?<!--\s*mergechain-deps:end\s*-->/gs;
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

const normalizeDeps = (deps: readonly PrRef[]): readonly PrRef[] => {
  const seenKeys = new Set<string>();
  return deps.filter((d) => {
    const k = `${d.owner.toLowerCase()}/${d.repo.toLowerCase()}#${d.number}`;
    if (seenKeys.has(k)) return false;
    seenKeys.add(k);
    return true;
  });
};

/** Build the hidden-comment line for a set of deps (deduplicates by ref key). */
export const encodeDeps = (deps: readonly PrRef[]): string => {
  const normalized = normalizeDeps(deps).map((d) => ({ owner: d.owner, repo: d.repo, number: d.number }));
  return `<!-- ${PREFIX}${JSON.stringify({ v: SCHEMA_VERSION, deps: normalized })} -->`;
};

const encodeManagedSection = (deps: readonly PrRef[]): string => {
  const normalized = normalizeDeps(deps);
  const refs = normalized.map((dep) => `- ${dep.owner}/${dep.repo}#${dep.number}`);
  return [
    '<!-- mergechain-deps:start -->',
    '### Merge dependencies',
    '',
    'Blocked by:',
    ...refs,
    '',
    encodeDeps(normalized),
    '<!-- mergechain-deps:end -->',
  ].join('\n');
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

/** Strip managed dependency data while preserving the rest of the PR body. */
export const stripDeps = (body: string): string =>
  body.replace(MANAGED_SECTION, '').replace(ALL_MARKERS, '').replace(/\n{3,}/g, '\n\n').trim();

/**
 * Insert or replace the managed dependency section in a PR body. Empty deps
 * removes both the visible section and hidden marker. Legacy marker-only bodies
 * are upgraded the next time they are edited.
 */
export const upsertDeps = (body: string, deps: readonly PrRef[]): string => {
  const clean = stripDeps(body);
  if (deps.length === 0) return clean;
  const section = encodeManagedSection(deps);
  return clean.length === 0 ? section : `${clean}\n\n${section}`;
};
