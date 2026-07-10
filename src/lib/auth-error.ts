import type { AppError } from '../messages.js';

// Pure classification of which AppErrors mean "the user must (re-)authenticate".
// Both the injected block and the popup turn these into a sign-in CTA instead of
// a dead-end red error, and the service worker flags the toolbar icon for them.

export type AuthPrompt = { readonly message: string; readonly action: string };

/** True when the error means the GitHub token is missing or no longer valid. */
export const isAuthError = (e: AppError): boolean =>
  e.kind === 'no-token' || (e.kind === 'http' && e.status === 401);

/**
 * CTA copy for an auth error, or null when the error isn't auth-related.
 * `message` explains what happened; `action` is the button label.
 */
export const authPrompt = (e: AppError): AuthPrompt | null => {
  if (e.kind === 'no-token') {
    return { message: 'Sign in to GitHub to enable PR dependencies.', action: 'Sign in with GitHub' };
  }
  if (e.kind === 'http' && e.status === 401) {
    return {
      message: 'Your GitHub sign-in expired. Re-authenticate to keep dependencies working.',
      action: 'Re-authenticate',
    };
  }
  return null;
};
