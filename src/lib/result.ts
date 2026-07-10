// Minimal Result<T, E> for FP-style error handling without exceptions.
// ponytail: hand-rolled instead of pulling in neverthrow — keeps the extension
// bundle zero-dependency. Add neverthrow only if we need its full combinator set.

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

export const map = <T, U, E>(r: Result<T, E>, f: (value: T) => U): Result<U, E> =>
  r.ok ? ok(f(r.value)) : r;

export const mapErr = <T, E, F>(r: Result<T, E>, f: (error: E) => F): Result<T, F> =>
  r.ok ? r : err(f(r.error));

export const andThen = <T, U, E>(
  r: Result<T, E>,
  f: (value: T) => Result<U, E>,
): Result<U, E> => (r.ok ? f(r.value) : r);

export const unwrapOr = <T, E>(r: Result<T, E>, fallback: T): T => (r.ok ? r.value : fallback);

// Collect a list of Results into a Result of a list. First error wins.
export const all = <T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> =>
  results.reduce<Result<readonly T[], E>>(
    (acc, r) => andThen(acc, (values) => map(r, (value) => [...values, value])),
    ok<readonly T[]>([]),
  );
