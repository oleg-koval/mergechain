import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, map, mapErr, andThen, unwrapOr, all } from '../src/lib/result.js';

describe('result', () => {
  it('constructs and narrows ok/err', () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(err('x'))).toBe(true);
    expect(isOk(err('x'))).toBe(false);
  });

  it('map only transforms ok', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
    expect(map(err<string>('boom'), (n: number) => n * 3)).toEqual(err('boom'));
  });

  it('mapErr only transforms err', () => {
    expect(mapErr(err('boom'), (e) => e.length)).toEqual(err(4));
    expect(mapErr(ok(1), (e: string) => e.length)).toEqual(ok(1));
  });

  it('andThen chains and short-circuits', () => {
    const half = (n: number) => (n % 2 === 0 ? ok(n / 2) : err('odd'));
    expect(andThen(ok(8), half)).toEqual(ok(4));
    expect(andThen(ok(7), half)).toEqual(err('odd'));
    expect(andThen(err<string>('pre'), half)).toEqual(err('pre'));
  });

  it('unwrapOr falls back on err', () => {
    expect(unwrapOr(ok(5), 0)).toBe(5);
    expect(unwrapOr(err('x'), 0)).toBe(0);
  });

  it('all collects values, first error wins', () => {
    expect(all([ok(1), ok(2), ok(3)])).toEqual(ok([1, 2, 3]));
    expect(all([ok(1), err('bad'), ok(3)])).toEqual(err('bad'));
    expect(all<number, string>([])).toEqual(ok([]));
  });
});
