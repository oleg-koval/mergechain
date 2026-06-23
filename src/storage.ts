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
