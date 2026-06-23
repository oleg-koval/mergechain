import type { Request, Response } from '../messages.js';
import { DEFAULT_SETTINGS, isPlacement, type Settings } from '../types/index.js';
import { loadSettings, saveSettings } from '../storage.js';
import { isAuthConfigured, requestDeviceCode, pollAccessToken } from '../api/device-auth.js';

// Options page wiring. Reads the form, writes Settings to chrome.storage.local.

// The ids are guaranteed by settings.html; cast directly (the FP ruleset bans
// throw statements, and these elements always exist on this page).
const token = document.getElementById('token') as HTMLInputElement;
const repos = document.getElementById('repos') as HTMLTextAreaElement;
const maxDepth = document.getElementById('maxDepth') as HTMLInputElement;
const placement = document.getElementById('placement') as HTMLSelectElement;
const showBlock = document.getElementById('showBlock') as HTMLInputElement;
const status = document.getElementById('status') as HTMLSpanElement;
const form = document.getElementById('form') as HTMLFormElement;
const verify = document.getElementById('verify') as HTMLButtonElement;
const verifyOut = document.getElementById('verifyOut') as HTMLSpanElement;
const signinBtn = document.getElementById('signinBtn') as HTMLButtonElement;
const signinOut = document.getElementById('signinOut') as HTMLSpanElement;
const advanced = document.getElementById('advanced') as HTMLDetailsElement;

const send = (req: Request): Promise<Response> => chrome.runtime.sendMessage(req);

const parseRepos = (raw: string): readonly string[] =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const clampDepth = (raw: string): number => {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_SETTINGS.maxDepth;
  return Math.min(50, Math.max(1, n));
};

const fill = (s: Settings): void => {
  token.value = s.token;
  repos.value = s.allowedRepos.join('\n');
  maxDepth.value = String(s.maxDepth);
  placement.value = s.placement;
  showBlock.checked = s.showBlock;
  // If a token already exists, surface who it belongs to on load.
  if (s.token !== '') void showIdentity(s.token);
};

const read = (): Settings => ({
  token: token.value.trim(),
  allowedRepos: parseRepos(repos.value),
  maxDepth: clampDepth(maxDepth.value),
  placement: isPlacement(placement.value) ? placement.value : DEFAULT_SETTINGS.placement,
  showBlock: showBlock.checked,
});

// Round-trips a token to GitHub via the background worker and reports who it
// belongs to. This is the user-facing proof that the token only ever contacts
// api.github.com — the request is observable in DevTools / chrome://net.
const showIdentity = async (value: string): Promise<void> => {
  const res = await send({ type: 'verify-token', token: value });
  if (res.type !== 'verify-token') return;
  if (res.result.ok) {
    const { login, scopes } = res.result.value;
    const scopeText = scopes.length > 0 ? ` · scopes: ${scopes.join(', ')}` : ' · fine-grained / app token';
    signinOut.className = 'ok';
    signinOut.textContent = `✓ Signed in as ${login}${scopeText}`;
  } else {
    signinOut.className = 'bad';
    signinOut.textContent =
      res.result.error.kind === 'http'
        ? `✗ GitHub rejected the token (HTTP ${String(res.result.error.status)})`
        : '✗ Could not reach GitHub.';
  }
};

form.addEventListener('submit', (e) => {
  e.preventDefault();
  void saveSettings(read()).then(() => {
    status.textContent = 'Saved';
    setTimeout(() => {
      status.textContent = '';
    }, 1500);
  });
});

// Placement is a live switch: persist immediately so the open PR tab moves the
// block at once (the content script listens for storage changes).
placement.addEventListener('change', () => {
  void saveSettings(read());
});

// Device-flow sign-in: ask GitHub for a code, open the verification page, poll
// until the user approves, then store the resulting token.
const runSignin = async (): Promise<void> => {
  if (!isAuthConfigured()) {
    signinOut.className = 'bad';
    signinOut.textContent = 'Sign-in not configured yet. Set GITHUB_APP_CLIENT_ID in src/config.ts (see SETUP.md), or use a token below.';
    advanced.open = true;
    return;
  }

  signinBtn.disabled = true;
  signinOut.className = '';
  signinOut.textContent = 'Requesting a device code from github.com…';

  const dc = await requestDeviceCode();
  if (!dc.ok) {
    signinBtn.disabled = false;
    signinOut.className = 'bad';
    signinOut.textContent = '✗ Could not start sign-in. Check the client ID and that Device Flow is enabled on the app.';
    return;
  }

  // Best-effort: copy the code so the user just pastes it on GitHub's page.
  void navigator.clipboard.writeText(dc.value.userCode).catch(() => undefined);
  signinOut.className = '';
  signinOut.innerHTML = `Enter <span class="code">${dc.value.userCode}</span> on the GitHub page (copied to clipboard), then approve. Waiting…`;
  window.open(dc.value.verificationUri, '_blank', 'noopener');

  const tok = await pollAccessToken(dc.value);
  signinBtn.disabled = false;
  if (!tok.ok) {
    signinOut.className = 'bad';
    signinOut.textContent = '✗ Sign-in was not completed (code expired or denied). Try again.';
    return;
  }

  token.value = tok.value;
  await saveSettings(read());
  await showIdentity(tok.value);
};

signinBtn.addEventListener('click', () => {
  void runSignin();
});

verify.addEventListener('click', () => {
  const value = token.value.trim();
  if (value === '') {
    verifyOut.className = 'bad';
    verifyOut.textContent = 'Enter a token first.';
    return;
  }
  verifyOut.className = '';
  verifyOut.textContent = 'Checking api.github.com…';
  void send({ type: 'verify-token', token: value }).then((res) => {
    if (res.type !== 'verify-token') return;
    if (res.result.ok) {
      const { login, scopes } = res.result.value;
      const scopeText = scopes.length > 0 ? ` · scopes: ${scopes.join(', ')}` : ' · fine-grained token';
      verifyOut.className = 'ok';
      verifyOut.textContent = `✓ Signed in as ${login}${scopeText}`;
    } else {
      verifyOut.className = 'bad';
      verifyOut.textContent =
        res.result.error.kind === 'http'
          ? `✗ GitHub rejected the token (HTTP ${String(res.result.error.status)})`
          : '✗ Could not reach GitHub.';
    }
  });
});

void loadSettings().then(fill);
