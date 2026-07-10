import { DEFAULT_SETTINGS, type Settings } from './types/index.js';

// chrome.storage.local access for settings. Effectful boundary.

const KEY = 'settings';

export const loadSettings = async (): Promise<Settings> => {
  const stored: Record<string, unknown> = await chrome.storage.local.get(KEY);
  const raw = stored[KEY];
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(raw as Partial<Settings>) };
};

export const saveSettings = async (settings: Settings): Promise<void> => {
  await chrome.storage.local.set({ [KEY]: settings });
};

// Runtime health flag (not a user setting): true when the GitHub token is
// missing or rejected, so the popup can show a sign-in CTA. The service worker
// writes it; the popup reads it and watches for changes.
export const AUTH_KEY = 'authNeeded';

export const loadAuthNeeded = async (): Promise<boolean> => {
  const stored: Record<string, unknown> = await chrome.storage.local.get(AUTH_KEY);
  return stored[AUTH_KEY] === true;
};

export const saveAuthNeeded = async (value: boolean): Promise<void> => {
  await chrome.storage.local.set({ [AUTH_KEY]: value });
};
