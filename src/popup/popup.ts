import { octiconSvg, type OcticonName } from '../components/octicons.js';
import { loadSettings, saveSettings, loadAuthNeeded, AUTH_KEY } from '../storage.js';
import { isPlacement, type Placement } from '../types/index.js';

// Toolbar popup: a directional pad to switch where the dependency block is
// injected. Saving fires a chrome.storage change that the content script picks
// up, so the open PR tab moves the block instantly.

const ICON: Record<Placement, OcticonName> = {
  top: 'arrow-up',
  bottom: 'arrow-down',
  left: 'arrow-left',
  right: 'arrow-right',
};
const LABEL: Record<Placement, string> = { top: 'Top', bottom: 'Bottom', left: 'Left', right: 'Right' };

const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button.pos'));
const center = document.getElementById('center') as HTMLSpanElement;
const gear = document.getElementById('gear') as HTMLSpanElement;
const openSettings = document.getElementById('open-settings') as HTMLButtonElement;
const authCta = document.getElementById('auth-cta') as HTMLDivElement;
const authCtaBtn = document.getElementById('auth-cta-btn') as HTMLButtonElement;

const markActive = (active: Placement): void => {
  buttons.forEach((b) => {
    b.classList.toggle('active', b.dataset['placement'] === active);
  });
};

const fill = (): void => {
  center.innerHTML = octiconSvg('git-pull-request');
  gear.innerHTML = octiconSvg('gear');
  buttons.forEach((b) => {
    const p = b.dataset['placement'];
    if (!isPlacement(p)) return;
    b.innerHTML = `${octiconSvg(ICON[p])}<span>${LABEL[p]}</span>`;
  });
};

buttons.forEach((b) => {
  b.addEventListener('click', () => {
    const p = b.dataset['placement'];
    if (!isPlacement(p)) return;
    markActive(p);
    void loadSettings().then((s) => saveSettings({ ...s, placement: p }));
  });
});

openSettings.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});

authCtaBtn.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});

// Mirror the toolbar badge: show the sign-in CTA whenever the worker has flagged
// the token as missing/expired, and react live if that flips while the popup is open.
const showAuthCta = (needed: boolean): void => {
  authCta.hidden = !needed;
};
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[AUTH_KEY]) showAuthCta(changes[AUTH_KEY].newValue === true);
});

fill();
void loadSettings().then((s) => {
  markActive(s.placement);
});
void loadAuthNeeded().then(showAuthCta);
