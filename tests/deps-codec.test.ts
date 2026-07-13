import { describe, it, expect } from 'vitest';
import { encodeDeps, decodeDeps, stripDeps, upsertDeps } from '../src/lib/deps-codec.js';
import type { PrRef } from '../src/types/index.js';

const a: PrRef = { owner: 'teifi-digital', repo: 'gic-live', number: 91 };
const b: PrRef = { owner: 'teifi-digital', repo: 'other-repo', number: 12 };

describe('deps-codec', () => {
  it('round-trips a dependency list through the hidden comment', () => {
    const body = `Some PR description\n\n${encodeDeps([a, b])}`;
    const decoded = decodeDeps(body);
    expect(decoded).toEqual({ ok: true, value: [a, b] });
  });

  it('treats a body with no marker as an empty list', () => {
    expect(decodeDeps('just a normal PR body')).toEqual({ ok: true, value: [] });
  });

  it('errors on malformed JSON rather than dropping deps silently', () => {
    const body = '<!-- pr-merge-deps:{not valid json} -->';
    const decoded = decodeDeps(body);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error.kind).toBe('invalid-json');
  });

  it('errors on valid JSON with the wrong shape', () => {
    const body = '<!-- pr-merge-deps:{"v":1,"deps":[{"owner":"o"}]} -->';
    const decoded = decodeDeps(body);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error.kind).toBe('invalid-shape');
  });

  it('stripDeps removes the marker and trims', () => {
    const body = `Hello\n\n${encodeDeps([a])}`;
    expect(stripDeps(body)).toBe('Hello');
  });

  it('upsertDeps writes a visible managed section with a hidden marker', () => {
    const body = upsertDeps('Body', [a, b]);
    expect(body).toContain('### Merge dependencies');
    expect(body).toContain('Blocked by:\n- teifi-digital/gic-live#91\n- teifi-digital/other-repo#12');
    expect(body).toContain(encodeDeps([a, b]));
  });

  it('upsertDeps replaces an existing section instead of appending a second', () => {
    const once = upsertDeps('Body', [a]);
    const twice = upsertDeps(once, [a, b]);
    expect(twice.match(/pr-merge-deps/g)?.length).toBe(1);
    expect(twice.match(/mergechain-deps:start/g)?.length).toBe(1);
    expect(twice).toContain('Body');
    expect(decodeDeps(twice)).toEqual({ ok: true, value: [a, b] });
  });

  it('upsertDeps with empty list removes the managed section and marker', () => {
    const withDep = upsertDeps('Body', [a]);
    expect(upsertDeps(withDep, [])).toBe('Body');
  });

  it('upsertDeps upgrades a legacy marker-only body on edit', () => {
    const legacy = `Body\n\n${encodeDeps([a])}`;
    const upgraded = upsertDeps(legacy, [a, b]);
    expect(upgraded).toContain('### Merge dependencies');
    expect(upgraded.match(/pr-merge-deps/g)?.length).toBe(1);
    expect(upgraded).toContain('Body');
  });

  it('upsertDeps deduplicates visible and encoded dependency entries', () => {
    const duplicate: PrRef = { owner: 'TEIFI-DIGITAL', repo: 'GIC-LIVE', number: 91 };
    const body = upsertDeps('', [a, duplicate]);
    expect(body.match(/gic-live#91/gi)?.length).toBe(1);
    expect(decodeDeps(body)).toEqual({ ok: true, value: [a] });
  });

  it('upsertDeps on an empty body yields just the managed section', () => {
    const body = upsertDeps('', [a]);
    expect(body.startsWith('<!-- mergechain-deps:start -->')).toBe(true);
    expect(body.endsWith('<!-- mergechain-deps:end -->')).toBe(true);
  });
});
