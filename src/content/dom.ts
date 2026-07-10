// All DOM side effects live here. The selectors target GitHub's PR merge box.
// ponytail: GitHub ships markup changes regularly — these selectors are a
// best-effort cascade with fallbacks; when GitHub moves the merge box, update
// MERGE_AREA_SELECTORS (the single point of fragility).

import type { Placement } from '../types/index.js';

const STYLE_ID = 'prdeps-style';
const ROOT_ID = 'prdeps-root';
const BLOCKED_CLASS = 'prdeps-merge-blocked';
// Short label the merge button shows while blocked; full reason stays in the
// tooltip + aria-label. Holds the button's original innerHTML so we can restore
// it verbatim on unblock.
const BLOCKED_LABEL = 'Waiting on deps';
const LABEL_ATTR = 'data-prdeps-label';

const MERGE_AREA_SELECTORS: readonly string[] = [
  '[data-testid="mergebox-partial"]',
  '.merge-pr',
  '#partial-pull-merging',
  '.js-merge-pr',
];

export const findMergeArea = (): HTMLElement | null => {
  for (const sel of MERGE_AREA_SELECTORS) {
    const found = document.querySelector<HTMLElement>(sel);
    if (found) return found;
  }
  return null;
};

export const findMergeButtons = (): readonly HTMLButtonElement[] => {
  const area = findMergeArea();
  if (!area) return [];
  // Match by label text, OR by our marker attribute: once we relabel a button
  // to BLOCKED_LABEL its text no longer matches the regex, so without the attr
  // check we'd lose track of it and never restore it.
  return [...area.querySelectorAll<HTMLButtonElement>('button')].filter(
    (b) => b.hasAttribute(LABEL_ATTR) || /\bmerge\b|squash|rebase/i.test(b.textContent),
  );
};

// Bring the dependency block into view, move focus to it (so it's announced),
// and pulse it — so a thwarted merge click points the user straight at *why*.
const FLASH_CLASS = 'prdeps-block--flash';
const revealBlock = (): void => {
  const block = document.getElementById(ROOT_ID);
  if (!block) return;
  if (typeof block.scrollIntoView === 'function') {
    block.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  block.tabIndex = -1;
  block.focus({ preventScroll: true }); // scrollIntoView already handles the scroll
  block.classList.remove(FLASH_CLASS);
  void block.offsetWidth; // reflow so re-adding the class restarts the animation
  block.classList.add(FLASH_CLASS);
  block.addEventListener('animationend', () => {
    block.classList.remove(FLASH_CLASS);
  }, { once: true });
};

// Intercepts click + Enter/Space activation while blocked so the button stays
// focusable and announces its reason (aria-disabled + title) without being
// removable from tab order the way native `disabled` would. A blocked
// activation also reveals the dependency block instead of silently doing
// nothing.
const blockInteraction = (e: Event): void => {
  e.preventDefault();
  e.stopPropagation();
  revealBlock();
};

const blockKeydown = (e: KeyboardEvent): void => {
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
    blockInteraction(e);
  }
};

export const setMergeBlocked = (blocked: boolean, reason: string): void => {
  findMergeButtons().forEach((btn) => {
    btn.classList.toggle(BLOCKED_CLASS, blocked);
    if (blocked) {
      // Capture the original label once (never re-capture our own text), then
      // swap it for the short blocked label. Full reason lives in title + aria.
      if (!btn.hasAttribute(LABEL_ATTR)) btn.setAttribute(LABEL_ATTR, btn.innerHTML);
      btn.textContent = BLOCKED_LABEL;
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('aria-label', reason);
      btn.setAttribute('title', reason);
      btn.addEventListener('click', blockInteraction, true);
      btn.addEventListener('keydown', blockKeydown, true);
    } else {
      const original = btn.getAttribute(LABEL_ATTR);
      if (original !== null) {
        btn.innerHTML = original; // restore the native label verbatim
        btn.removeAttribute(LABEL_ATTR);
      }
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('aria-label');
      btn.removeAttribute('title');
      btn.removeEventListener('click', blockInteraction, true);
      btn.removeEventListener('keydown', blockKeydown, true);
    }
  });
};

type Anchor = { readonly parent: HTMLElement; readonly before: Node | null };

// Selector cascades are the single point of fragility — update here if GitHub
// moves these regions. ponytail: each placement falls back so the block is
// never lost when a selector misses.
const DESCRIPTION_SELECTORS: readonly string[] = [
  '[data-testid="issue-body"]',
  '[data-testid="comment-viewer-outer-box"]',
];
const TIMELINE_SELECTORS: readonly string[] = ['.js-discussion', '#discussion_bucket'];
const SIDEBAR_SELECTORS: readonly string[] = [
  '[data-testid="sidebar"]',
  '#partial-discussion-sidebar',
  '.Layout-sidebar',
];

const topAnchor = (): Anchor | null => {
  for (const sel of DESCRIPTION_SELECTORS) {
    const node = document.querySelector<HTMLElement>(sel);
    if (node?.parentElement) return { parent: node.parentElement, before: node };
  }
  for (const sel of TIMELINE_SELECTORS) {
    const node = document.querySelector<HTMLElement>(sel);
    if (node) return { parent: node, before: node.firstChild };
  }
  return null;
};

const mergeAnchor = (): Anchor | null => {
  const area = findMergeArea();
  return area?.parentElement ? { parent: area.parentElement, before: area } : null;
};

const sidebarAnchor = (): Anchor | null => {
  for (const sel of SIDEBAR_SELECTORS) {
    const node = document.querySelector<HTMLElement>(sel);
    if (node) return { parent: node, before: node.firstChild };
  }
  return null;
};

const anchorFor = (placement: Placement): Anchor | null => {
  switch (placement) {
    case 'bottom':
      return mergeAnchor() ?? topAnchor();
    case 'right':
      return sidebarAnchor() ?? topAnchor() ?? mergeAnchor();
    case 'left':
      // Floating panel in the left gutter; positioned via CSS, lives on <body>.
      return { parent: document.body, before: null };
    case 'top':
      return topAnchor() ?? mergeAnchor();
  }
};

// `.prdeps-block--at-left` scrolls (`overflow-y: auto; max-height: 80vh`) so a
// long autocomplete result list near the panel bottom would otherwise be
// clipped by that scrolling ancestor. Only `position: fixed` reliably escapes
// an ancestor's overflow clipping, so in left placement we pin the dropdown to
// the viewport, synced to its trigger field's rect. Other placements are left
// on the plain CSS `position: absolute` (unaffected — those anchors don't scroll).
const DROPDOWN_ESCAPE_ATTR = 'data-prdeps-escaped';

const clearDropdownEscape = (dropdown: HTMLElement): void => {
  dropdown.style.removeProperty('position');
  dropdown.style.removeProperty('top');
  dropdown.style.removeProperty('left');
  dropdown.style.removeProperty('right');
  dropdown.style.removeProperty('width');
  dropdown.style.removeProperty('margin-top');
  dropdown.removeAttribute(DROPDOWN_ESCAPE_ATTR);
};

const syncDropdownEscape = (dropdown: HTMLElement, field: HTMLElement): void => {
  const rect = field.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.right = 'auto';
  dropdown.style.top = `${rect.bottom + 4}px`;
  dropdown.style.marginTop = '0';
  dropdown.style.width = `${rect.width}px`;
};

// One set of viewport listeners, installed once, that keeps the escaped
// dropdown (if any) glued to its field across scroll/resize/DOM changes —
// e.g. results arriving async and changing the dropdown's height.
let dropdownEscapeWired = false;
const wireDropdownEscape = (): void => {
  if (dropdownEscapeWired) return;
  dropdownEscapeWired = true;
  const resync = (): void => {
    const dropdown = document.querySelector<HTMLElement>(
      `.prdeps-block--at-left .prdeps-dropdown[${DROPDOWN_ESCAPE_ATTR}]`,
    );
    const field = dropdown?.previousElementSibling;
    if (dropdown && field instanceof HTMLElement) syncDropdownEscape(dropdown, field);
  };
  window.addEventListener('scroll', resync, true);
  window.addEventListener('resize', resync);
  new MutationObserver(resync).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });
};

// Called after every (re)mount so a freshly-created dropdown in a left-placed
// block gets escaped from the panel's scrolling overflow; other placements get
// any stale inline overrides cleared so the plain CSS rules apply.
const applyDropdownEscape = (block: HTMLElement, placement: Placement): void => {
  const dropdown = block.querySelector<HTMLElement>('.prdeps-dropdown');
  if (!dropdown) return;
  if (placement === 'left') {
    dropdown.setAttribute(DROPDOWN_ESCAPE_ATTR, '');
    const field = dropdown.previousElementSibling;
    if (field instanceof HTMLElement) syncDropdownEscape(dropdown, field);
    wireDropdownEscape();
  } else {
    clearDropdownEscape(dropdown);
  }
};

export const mountBlock = (block: HTMLElement, placement: Placement): boolean => {
  const anchor = anchorFor(placement);
  if (!anchor) return false;
  block.id = ROOT_ID;
  block.classList.add(`prdeps-block--at-${placement}`);
  block.dataset['placement'] = placement;
  const existing = document.getElementById(ROOT_ID);
  if (existing && existing.dataset['placement'] === placement) {
    existing.replaceWith(block); // same spot — swap in place, no flicker
  } else {
    existing?.remove(); // placement changed (or first mount) — move to new anchor
    anchor.parent.insertBefore(block, anchor.before);
  }
  applyDropdownEscape(block, placement);
  return true;
};

export const blockExists = (): boolean => document.getElementById(ROOT_ID) !== null;

export const removeBlock = (): void => {
  document.getElementById(ROOT_ID)?.remove();
};

// Dim the block while an action is in flight (instead of flashing the skeleton).
export const setBusy = (busy: boolean): void => {
  document.getElementById(ROOT_ID)?.classList.toggle('prdeps-block--busy', busy);
};

export const injectStyles = (): void => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
};

/**
 * Inject a small status badge after a PR list-row title link.
 * Idempotent: skips the link if already badged (data-prdeps-badge attribute).
 */
export const injectListBadge = (link: HTMLAnchorElement, blocked: boolean): void => {
  if (link.dataset['prdepsBadge']) return;
  link.dataset['prdepsBadge'] = '1';
  const badge = document.createElement('span');
  badge.className = `prdeps-list-badge prdeps-list-badge--${blocked ? 'blocked' : 'ready'}`;
  badge.textContent = blocked ? 'Blocked' : 'Ready';
  link.after(badge);
};

// GitHub Primer color tokens with hard fallbacks so it reads in both themes.
const CSS = `
/* Outer block — flex row matching GitHub's branch-action-item layout */
.prdeps-block {
  display: flex;
  border: 1px solid var(--borderColor-default, #30363d);
  border-radius: 6px;
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--fgColor-default, #e6edf3);
}
.prdeps-block--blocked { border-color: var(--borderColor-danger-emphasis, #f85149); }
/* Gentle settle-in whenever the block (re)renders */
@keyframes prdeps-fade-in {
  from { opacity: 0; transform: translateY(-3px); }
  to { opacity: 1; transform: translateY(0); }
}
.prdeps-block { animation: prdeps-fade-in 0.24s ease-out; transition: opacity 0.15s ease; }
.prdeps-block--busy { opacity: 0.5; pointer-events: none; }
/* Attention pulse when a blocked merge click reveals the block */
@keyframes prdeps-flash {
  0%, 60% { box-shadow: 0 0 0 3px var(--borderColor-accent-emphasis, #2f81f7); }
  100% { box-shadow: 0 0 0 3px transparent; }
}
.prdeps-block--flash { animation: prdeps-flash 1s ease-out; }
.prdeps-block:focus-visible { outline: none; }
@media (prefers-reduced-motion: reduce) {
  .prdeps-block, .prdeps-block--flash { animation: none; }
}
/* Placement: left gutter — floating, fixed to the viewport's left edge.
   width clamps to the viewport so it never collapses or runs off-screen; on
   narrow viewports it shrinks and rides higher to stay out of the content. */
.prdeps-block--at-left {
  position: fixed; left: 16px; top: 96px;
  width: min(300px, calc(100vw - 32px));
  max-height: 80vh; overflow-y: auto; z-index: 50;
  box-shadow: var(--shadow-floating-large, 0 8px 24px rgba(1,4,9,.5));
}
@media (max-width: 1280px) {
  .prdeps-block--at-left { top: 56px; width: min(280px, calc(100vw - 24px)); }
}
/* Placement: sidebar (right, above reviewers) — full sidebar width */
.prdeps-block--at-right { width: 100%; margin-bottom: 16px; font-size: 13px; }
.prdeps-block--at-right .prdeps-icon-col { width: 34px; padding-top: 12px; }
.prdeps-block--at-right .prdeps-content { padding: 10px 12px; }
/* Left icon column — mirrors GitHub's ~44px branch-action-icon strip */
.prdeps-icon-col {
  width: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 14px;
  background: var(--bgColor-muted, #161b22);
  border-right: 1px solid var(--borderColor-muted, #21262d);
  border-radius: 5px 0 0 5px;
}
.prdeps-block--blocked .prdeps-icon-col {
  border-right-color: var(--borderColor-danger-muted, rgba(248,81,73,.4));
}
/* Every injected octicon renders as a block-level SVG filled with currentColor */
.prdeps-icon svg, .prdeps-chain-icon svg, .prdeps-summary-icon svg,
.prdeps-warning-icon svg, .prdeps-remove svg, .prdeps-modebtn-icon svg { display: block; }
/* The dependency octicon inside the left column */
.prdeps-chain-icon--default { color: var(--fgColor-muted, #8b949e); }
.prdeps-chain-icon--blocked { color: var(--fgColor-danger, #f85149); }
.prdeps-chain-icon--clear   { color: var(--fgColor-success, #3fb950); }
.prdeps-chain-icon--warning { color: var(--fgColor-attention, #d29922); }
/* Content area — takes the rest of the width */
.prdeps-content {
  flex: 1;
  min-width: 0;
  padding: 12px 16px;
  background: var(--bgColor-muted, #161b22);
  border-radius: 0 5px 5px 0;
}
.prdeps-header { display: flex; align-items: center; gap: 8px; }
.prdeps-heading { font-weight: 600; font-size: 14px; }
.prdeps-pill {
  margin-left: auto;
  font-size: 12px; font-weight: 500; padding: 1px 8px; border-radius: 999px;
  background: var(--bgColor-neutral-muted, #6e768166); color: var(--fgColor-muted, #8b949e);
}
.prdeps-pill--blocked { background: var(--bgColor-danger-emphasis, #da3633); color: #fff; }
.prdeps-pill--clear { background: var(--bgColor-success-emphasis, #238636); color: #fff; }
.prdeps-pill--warning { background: var(--bgColor-attention-emphasis, #9e6a03); color: #fff; }
/* Summary line — leads the body, mirrors GitHub's status phrasing */
.prdeps-summary {
  display: flex; align-items: center; gap: 8px;
  margin: 10px 0 6px; font-size: 13px; font-weight: 500;
}
.prdeps-summary--blocked { color: var(--fgColor-danger, #f85149); }
.prdeps-summary--clear { color: var(--fgColor-success, #3fb950); }
.prdeps-summary-icon { flex-shrink: 0; }
/* Warning banner — graph problem the user can fix; non-blocking */
.prdeps-warning {
  display: flex; align-items: center; gap: 8px;
  margin: 10px 0 6px; font-size: 13px; font-weight: 500;
  color: var(--fgColor-attention, #d29922);
}
.prdeps-warning-icon { flex-shrink: 0; }
/* Advisory: the merge-block is browser-side only */
.prdeps-advisory {
  font-size: 12px; color: var(--fgColor-muted, #8b949e);
  margin: -2px 0 8px; padding-left: 0;
}
/* Dependency / dependent rows */
.prdeps-list { display: flex; flex-direction: column; }
.prdeps-row { display: flex; align-items: center; gap: 4px; }
.prdeps-link {
  display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;
  padding: 5px 6px; margin: 0 -6px; border-radius: 6px;
  color: var(--fgColor-default, #e6edf3); text-decoration: none;
}
.prdeps-link:hover { background: var(--bgColor-neutral-muted, #6e768119); }
.prdeps-link:hover .prdeps-title { text-decoration: underline; }
.prdeps-icon { flex-shrink: 0; }
.prdeps-row--open .prdeps-icon { color: var(--fgColor-open, #3fb950); }
.prdeps-row--merged .prdeps-icon { color: var(--fgColor-done, #a371f7); }
.prdeps-row--closed .prdeps-icon { color: var(--fgColor-closed, #f85149); }
.prdeps-ref { font-family: ui-monospace, monospace; font-size: 12px; color: var(--fgColor-muted, #8b949e); flex-shrink: 0; }
.prdeps-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prdeps-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.prdeps-remove, .prdeps-flip {
  display: flex; flex-shrink: 0; border: none; background: transparent; cursor: pointer;
  color: var(--fgColor-muted, #8b949e); padding: 6px; border-radius: 6px;
}
/* Inline confirm strip (replaces the row's action buttons) */
.prdeps-confirm { display: flex; align-items: center; gap: 6px; }
.prdeps-confirm-label { font-size: 12px; color: var(--fgColor-muted, #8b949e); white-space: nowrap; }
.prdeps-confirm-yes, .prdeps-confirm-no {
  font-size: 12px; font-weight: 500; padding: 2px 8px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--borderColor-default, #30363d); background: transparent; color: inherit;
}
.prdeps-confirm-yes--accent { background: var(--bgColor-accent-emphasis, #1f6feb); color: #fff; border-color: transparent; }
.prdeps-confirm-yes--danger { background: var(--bgColor-danger-emphasis, #da3633); color: #fff; border-color: transparent; }
.prdeps-confirm-no { color: var(--fgColor-muted, #8b949e); }
.prdeps-confirm-no:hover { color: var(--fgColor-default, #e6edf3); }
.prdeps-flip svg { display: block; }
.prdeps-flip:hover { color: var(--borderColor-accent-emphasis, #2f81f7); background: var(--bgColor-neutral-muted, #6e768119); }
.prdeps-remove:hover { color: var(--fgColor-danger, #f85149); background: var(--bgColor-danger-muted, #f8514919); }
/* Reverse-dependents section */
.prdeps-dependents { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--borderColor-muted, #21262d); }
.prdeps-subhead {
  font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em;
  color: var(--fgColor-muted, #8b949e); margin-bottom: 6px;
}
.prdeps-empty, .prdeps-error, .prdeps-indirect {
  color: var(--fgColor-muted, #8b949e); font-size: 13px; padding: 4px 0;
}
.prdeps-error { color: var(--fgColor-danger, #f85149); }
/* Sign-in CTA — recoverable auth state (missing/expired token) */
.prdeps-auth { margin: 10px 0 2px; }
.prdeps-auth-msg { font-size: 13px; color: var(--fgColor-default, #e6edf3); margin-bottom: 10px; }
.prdeps-cta {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
  border: 1px solid var(--borderColor-accent-emphasis, #1f6feb); border-radius: 6px;
  background: var(--bgColor-accent-emphasis, #1f6feb); color: #fff;
}
.prdeps-cta:hover { background: var(--button-primary-bgColor-hover, #388bfd); border-color: var(--button-primary-bgColor-hover, #388bfd); }
/* Loading skeleton */
.prdeps-skeleton {
  border-radius: 6px;
  background: linear-gradient(90deg,
    var(--bgColor-neutral-muted, #6e768119) 25%,
    var(--bgColor-neutral-muted, #6e768133) 37%,
    var(--bgColor-neutral-muted, #6e768119) 63%);
  background-size: 400% 100%;
  animation: prdeps-shimmer 1.4s ease infinite;
}
.prdeps-skeleton--icon { width: 16px; height: 16px; flex-shrink: 0; }
.prdeps-skeleton--text { height: 14px; flex: 1; }
.prdeps-row .prdeps-skeleton { margin: 5px 0; }
@keyframes prdeps-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
.prdeps-add { position: relative; margin-top: 8px; }
/* Input + inline direction pill share one row */
.prdeps-field { display: flex; align-items: stretch; }
.prdeps-input {
  flex: 1; min-width: 0; box-sizing: border-box; padding: 5px 8px; font-size: 13px;
  border: 1px solid var(--borderColor-default, #30363d); border-right: none;
  border-radius: 6px 0 0 6px;
  background: var(--bgColor-default, #0d1117); color: var(--fgColor-default, #e6edf3);
}
.prdeps-input:focus {
  outline: none; border-color: var(--borderColor-accent-emphasis, #2f81f7);
  box-shadow: 0 0 0 1px var(--borderColor-accent-emphasis, #2f81f7);
}
/* Clickable direction pill: flips Blocked by <-> Blocks */
.prdeps-modebtn {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0; white-space: nowrap;
  padding: 0 10px; font-size: 12px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--borderColor-default, #30363d); border-radius: 0 6px 6px 0;
  background: var(--bgColor-neutral-muted, #6e768119); color: var(--fgColor-muted, #8b949e);
}
.prdeps-modebtn:hover { color: var(--fgColor-default, #e6edf3); border-color: var(--borderColor-accent-emphasis, #2f81f7); }
.prdeps-modebtn-icon { display: flex; }
.prdeps-modebtn-icon svg { display: block; }
/* Fixed width so flipping Blocked by <-> Blocks never resizes the pill */
.prdeps-modebtn-label { min-width: 62px; text-align: left; }
/* Two-tone arrows: accent = the selected direction, gray = the other. Accent
   (not red) so "selected" doesn't read as "blocked/bad" like red does elsewhere. */
.prdeps-modebtn--blocked-by .prdeps-arrow--in  { fill: var(--fgColor-accent, #2f81f7); }
.prdeps-modebtn--blocked-by .prdeps-arrow--out { fill: var(--fgColor-muted, #8b949e); }
.prdeps-modebtn--blocks     .prdeps-arrow--out { fill: var(--fgColor-accent, #2f81f7); }
.prdeps-modebtn--blocks     .prdeps-arrow--in  { fill: var(--fgColor-muted, #8b949e); }
.prdeps-dropdown {
  position: absolute; left: 0; right: 0; z-index: 51;
  background: var(--bgColor-default, #0d1117); border: 1px solid var(--borderColor-default, #30363d);
  border-radius: 6px; margin-top: 4px; max-height: 240px; overflow-y: auto;
  box-shadow: var(--shadow-floating-small, 0 6px 18px rgba(1,4,9,.4));
}
/* Left placement: escaped to fixed positioning in JS (mountBlock calls
   applyDropdownEscape) since the panel's own overflow-y:auto would otherwise
   clip an absolutely-positioned dropdown near the bottom of a long list. */
.prdeps-dropdown:empty { display: none; }
.prdeps-option {
  display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 6px 8px;
  border: none; background: transparent; cursor: pointer; color: var(--fgColor-default, #e6edf3);
}
.prdeps-option:hover, .prdeps-option--active { background: var(--bgColor-neutral-muted, #6e768133); }
/* Keyboard position must not be signalled by background color alone */
.prdeps-option--active {
  box-shadow: inset 0 0 0 2px var(--borderColor-accent-emphasis, #2f81f7);
}
/* Visible focus ring for interactive icon buttons, consistent with .prdeps-input:focus */
.prdeps-remove:focus-visible,
.prdeps-flip:focus-visible,
.prdeps-modebtn:focus-visible,
.prdeps-cta:focus-visible,
.prdeps-confirm-yes:focus-visible,
.prdeps-confirm-no:focus-visible,
.prdeps-option:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--borderColor-accent-emphasis, #2f81f7);
}
.prdeps-merge-blocked {
  background: var(--bgColor-danger-emphasis, #da3633) !important;
  border-color: var(--borderColor-danger-emphasis, #f85149) !important;
  color: #fff !important; cursor: not-allowed !important; opacity: 1 !important;
}
.prdeps-list-badge {
  display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 10px;
  font-size: 11px; font-weight: 600; vertical-align: middle; line-height: 1.6;
}
.prdeps-list-badge--blocked {
  background: var(--bgColor-danger-muted, #ffd7d5); color: var(--fgColor-danger, #cf222e);
  border: 1px solid var(--borderColor-danger-emphasis, #f85149);
}
.prdeps-list-badge--ready {
  background: var(--bgColor-success-muted, #dafbe1); color: var(--fgColor-success, #1a7f37);
  border: 1px solid var(--borderColor-success-emphasis, #2da44e);
}
/* ── Graph view ─────────────────────────────────────────────────────────── */
/* Segmented List | Graph toggle, sat between the heading and the status pill */
.prdeps-viewtoggle {
  display: inline-flex; margin-left: 12px;
  border: 1px solid var(--borderColor-default, #30363d); border-radius: 6px; overflow: hidden;
}
.prdeps-viewbtn {
  border: none; background: transparent; cursor: pointer;
  padding: 2px 10px; font-size: 12px; font-weight: 500;
  color: var(--fgColor-muted, #8b949e);
}
.prdeps-viewbtn + .prdeps-viewbtn { border-left: 1px solid var(--borderColor-default, #30363d); }
.prdeps-viewbtn:hover { color: var(--fgColor-default, #e6edf3); }
.prdeps-viewbtn--active {
  background: var(--bgColor-accent-muted, #388bfd1a); color: var(--fgColor-default, #e6edf3);
}
.prdeps-viewbtn:focus-visible {
  outline: none; box-shadow: inset 0 0 0 2px var(--borderColor-accent-emphasis, #2f81f7);
}
/* Scroll container: narrow (left/right) placements scroll rather than clip */
.prdeps-graph { margin-top: 10px; overflow-x: auto; overflow-y: hidden; }
.prdeps-graph-canvas { position: relative; }
/* Edge layer sits behind the node pills; never intercepts clicks */
.prdeps-graph-edges { position: absolute; top: 0; left: 0; overflow: visible; pointer-events: none; }
.prdeps-edge { fill: none; stroke: var(--borderColor-default, #30363d); stroke-width: 1.5; }
.prdeps-edge--blocking { stroke: var(--fgColor-danger, #f85149); }
.prdeps-arrowhead { fill: var(--borderColor-default, #30363d); }
.prdeps-arrowhead--blocking { fill: var(--fgColor-danger, #f85149); }
/* Node pill: compact, mirrors the list rows' visual language */
.prdeps-gnode {
  position: absolute; box-sizing: border-box;
  display: flex; align-items: center; gap: 6px; padding: 0 8px;
  border: 1px solid var(--borderColor-default, #30363d); border-radius: 6px;
  background: var(--bgColor-default, #0d1117); color: var(--fgColor-default, #e6edf3);
  font-size: 12px; text-decoration: none; overflow: hidden;
}
a.prdeps-gnode { cursor: pointer; }
a.prdeps-gnode:hover {
  border-color: var(--borderColor-accent-emphasis, #2f81f7);
  background: var(--bgColor-neutral-muted, #6e768119);
}
a.prdeps-gnode:hover .prdeps-gtitle { text-decoration: underline; }
a.prdeps-gnode:focus-visible {
  outline: none; box-shadow: 0 0 0 2px var(--borderColor-accent-emphasis, #2f81f7);
}
/* The current PR — heavier ring + weight so it reads as "you are here" */
.prdeps-gnode--root {
  border-width: 2px; border-color: var(--borderColor-accent-emphasis, #2f81f7); font-weight: 600;
}
/* An unmerged blocker on the path — danger border (root ring wins if both) */
.prdeps-gnode--blocking { border-color: var(--borderColor-danger-emphasis, #f85149); }
.prdeps-gnode--open .prdeps-icon { color: var(--fgColor-open, #3fb950); }
.prdeps-gnode--merged .prdeps-icon { color: var(--fgColor-done, #a371f7); }
.prdeps-gnode--closed .prdeps-icon { color: var(--fgColor-closed, #f85149); }
.prdeps-gnode .prdeps-icon { flex-shrink: 0; }
.prdeps-gref {
  font-family: ui-monospace, monospace; font-size: 11px;
  color: var(--fgColor-muted, #8b949e); flex-shrink: 0;
}
.prdeps-gtitle { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
