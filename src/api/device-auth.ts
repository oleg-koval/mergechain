import type { AppError } from '../messages.js';
import { type Result, ok, err } from '../lib/result.js';
import {
  GITHUB_APP_CLIENT_ID,
  GITHUB_DEVICE_CODE_URL,
  GITHUB_ACCESS_TOKEN_URL,
} from '../config.js';

// GitHub OAuth Device Flow — the serverless sign-in path. Only the public
// client_id is used; no client secret exists, so this runs entirely in the
// browser. Network boundary, so the imperative poll loop lives here, not in the
// pure core.
//
// Flow: requestDeviceCode() -> show user_code, open verification_uri ->
// pollAccessToken() blocks until the user approves (or it expires).

export type DeviceCode = {
  readonly userCode: string;
  readonly verificationUri: string;
  readonly deviceCode: string;
  readonly interval: number;
  readonly expiresIn: number;
};

export const isAuthConfigured = (): boolean => GITHUB_APP_CLIENT_ID !== '';

const form = (fields: Record<string, string>): string =>
  new URLSearchParams(fields).toString();

const asRecord = (x: unknown): Record<string, unknown> =>
  typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Step 1: ask GitHub for a device + user code. */
export const requestDeviceCode = async (): Promise<Result<DeviceCode, AppError>> => {
  try {
    const res = await fetch(GITHUB_DEVICE_CODE_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_id: GITHUB_APP_CLIENT_ID }),
    });
    if (!res.ok) return err({ kind: 'http', status: res.status });
    const j = asRecord((await res.json()) as unknown);
    const deviceCode = j['device_code'];
    const userCode = j['user_code'];
    if (typeof deviceCode !== 'string' || typeof userCode !== 'string') {
      return err({ kind: 'parse' });
    }
    return ok({
      deviceCode,
      userCode,
      verificationUri: typeof j['verification_uri'] === 'string' ? j['verification_uri'] : 'https://github.com/login/device',
      interval: typeof j['interval'] === 'number' ? j['interval'] : 5,
      expiresIn: typeof j['expires_in'] === 'number' ? j['expires_in'] : 900,
    });
  } catch {
    return err({ kind: 'network' });
  }
};

/**
 * Step 2: poll until the user authorizes. Respects GitHub's `interval` and
 * `slow_down` backoff, and gives up when the device code expires.
 */
export const pollAccessToken = async (dc: DeviceCode): Promise<Result<string, AppError>> => {
  let interval = dc.interval;
  const deadline = Date.now() + dc.expiresIn * 1000;

  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    try {
      const res = await fetch(GITHUB_ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({
          client_id: GITHUB_APP_CLIENT_ID,
          device_code: dc.deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });
      const j = asRecord((await res.json()) as unknown);

      const token = j['access_token'];
      if (typeof token === 'string' && token !== '') return ok(token);

      const error = j['error'];
      if (error === 'authorization_pending') continue;
      if (error === 'slow_down') {
        interval = typeof j['interval'] === 'number' ? j['interval'] : interval + 5;
        continue;
      }
      // expired_token, access_denied, or anything unexpected: stop.
      return err({ kind: 'http', status: res.status });
    } catch {
      return err({ kind: 'network' });
    }
  }
  return err({ kind: 'http', status: 408 });
};
