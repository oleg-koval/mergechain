import { describe, it, expect } from 'vitest';
import type { AppError } from '../src/messages.js';
import { isAuthError, authPrompt } from '../src/lib/auth-error.js';

// The auth classifier decides when a failure becomes a sign-in CTA (block +
// popup + toolbar badge) instead of a dead-end red error.

describe('auth-error classification', () => {
  it('treats a missing token as an auth error', () => {
    const e: AppError = { kind: 'no-token' };
    expect(isAuthError(e)).toBe(true);
    expect(authPrompt(e)?.action).toBe('Sign in with GitHub');
  });

  it('treats HTTP 401 (expired/invalid token) as an auth error', () => {
    const e: AppError = { kind: 'http', status: 401 };
    expect(isAuthError(e)).toBe(true);
    expect(authPrompt(e)?.action).toBe('Re-authenticate');
    expect(authPrompt(e)?.message).toMatch(/expired/i);
  });

  it('does NOT treat 403/404 (repo access) as an auth error — that needs a different fix', () => {
    for (const status of [403, 404]) {
      const e: AppError = { kind: 'http', status };
      expect(isAuthError(e)).toBe(false);
      expect(authPrompt(e)).toBeNull();
    }
  });

  it('does NOT treat network / parse / graph errors as auth errors', () => {
    const errors: readonly AppError[] = [
      { kind: 'network' },
      { kind: 'parse' },
      { kind: 'codec' },
      { kind: 'http', status: 500 },
      { kind: 'depth-exceeded', maxDepth: 10 },
    ];
    for (const e of errors) {
      expect(isAuthError(e)).toBe(false);
      expect(authPrompt(e)).toBeNull();
    }
  });
});
