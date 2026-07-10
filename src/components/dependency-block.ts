import type { PrRef, PrState } from '../types/index.js';
import type { DepStatus, PrSummaryWire, ResolveResult } from '../messages.js';
import { formatRefShort, parseRef, prUrl, refKey } from '../lib/pr-ref.js';
import { octiconSvg, type OcticonName } from './octicons.js';

// Pure-ish builder: given the current PR, the resolve state, and callbacks,
// returns the dependency block element. No global state; the content script
// re-invokes this on every change. Visual language mirrors GitHub's merge box:
// a left icon column + a content area, Primer octicons, and clickable refs.

export type BlockState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  // Recoverable: token missing or expired. Shows a sign-in CTA, not a dead end.
  | { readonly kind: 'auth'; readonly message: string; readonly action: string }
  | { readonly kind: 'ready'; readonly result: ResolveResult };

export type BlockCallbacks = {
  readonly onSearch: (query: string) => Promise<readonly PrSummaryWire[]>;
  /** "Blocked by": add the target to this PR's deps (this PR waits on it). */
  readonly onAdd: (ref: PrRef) => void;
  /** "Blocks": add this PR to the target's deps (the target waits on this PR). */
  readonly onAddBlocks: (target: PrRef) => void;
  readonly onRemove: (ref: PrRef) => void;
  /** Clear a reverse dependent: drop this PR from the dependent PR's deps. */
  readonly onRemoveDependent: (dependent: PrRef) => void;
  /** Reverse an existing edge. blockedBy = its current direction. */
  readonly onFlip: (other: PrRef, blockedBy: boolean) => void;
  /** Open the extension settings to (re-)authenticate with GitHub. */
  readonly onSignIn: () => void;
};

const STATE_ICON: Record<PrState, OcticonName> = {
  open: 'git-pull-request',
  merged: 'git-merge',
  closed: 'git-pull-request-closed',
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const icon = (name: OcticonName, className: string): HTMLElement => {
  const span = el('span', className);
  span.innerHTML = octiconSvg(name);
  return span;
};

// Two-tone direction glyph: the arrow-switch octicon split into two independently
// colorable paths. Top arrow points right (this PR → other = "blocks"); bottom
// arrow points left (other → this PR = "blocked by"). CSS reds the active one.
const DIRECTION_SVG =
  '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">' +
  '<path class="prdeps-arrow--out" d="M10.78 8.28a.75.75 0 1 1-1.06-1.06l1.72-1.72H2.75a.75.75 0 0 1 0-1.5h8.69L9.72 2.28a.75.75 0 0 1 1.06-1.06l3 3a.75.75 0 0 1 0 1.06l-3 3Z"/>' +
  '<path class="prdeps-arrow--in" d="M5.22 14.78a.75.75 0 0 0 1.06-1.06L4.56 12h8.69a.75.75 0 0 0 0-1.5H4.56l1.72-1.72a.75.75 0 0 0-1.06-1.06l-3 3a.75.75 0 0 0 0 1.06l3 3Z"/>' +
  '</svg>';

const directionIcon = (): HTMLElement => {
  const span = el('span', 'prdeps-modebtn-icon');
  span.innerHTML = DIRECTION_SVG;
  return span;
};

// A clickable reference: octicon + #ref + title, linking to the PR. Shared by
// the dependency rows and the reverse-dependents list.
const refLink = (current: PrRef, dep: DepStatus): HTMLAnchorElement => {
  const link = el('a', `prdeps-link prdeps-row--${dep.state}`);
  link.href = prUrl(dep.ref);
  link.appendChild(icon(STATE_ICON[dep.state], 'prdeps-icon'));
  link.appendChild(el('span', 'prdeps-ref', formatRefShort(dep.ref, current)));
  link.appendChild(el('span', 'prdeps-title', dep.title || '(untitled)'));
  return link;
};

// An inline confirm strip that replaces a row's action buttons — our own styled
// in-page confirmation instead of the browser's native confirm() dialog.
const confirmStrip = (
  label: string,
  tone: 'accent' | 'danger',
  onYes: () => void,
  onCancel: () => void,
): HTMLElement => {
  const wrap = el('div', 'prdeps-confirm');
  wrap.appendChild(el('span', 'prdeps-confirm-label', label));
  const yes = el('button', `prdeps-confirm-yes prdeps-confirm-yes--${tone}`, 'Confirm');
  yes.type = 'button';
  yes.addEventListener('click', onYes);
  const no = el('button', 'prdeps-confirm-no', 'Cancel');
  no.type = 'button';
  no.addEventListener('click', onCancel);
  wrap.appendChild(yes);
  wrap.appendChild(no);
  return wrap;
};

// A relationship row: clickable ref link + a ⇄ flip button (reverse direction)
// + a × remove. `direction` is the edge's current direction, which decides what
// flip/remove do. Actions that edit the OTHER PR show an inline confirm first.
const relationRow = (
  current: PrRef,
  dep: DepStatus,
  direction: 'blocked-by' | 'blocks',
  cb: BlockCallbacks,
): HTMLElement => {
  const blockedBy = direction === 'blocked-by';
  const shortRef = formatRefShort(dep.ref, current);
  const row = el('div', 'prdeps-row');
  row.appendChild(refLink(current, dep));

  const actions = el('div', 'prdeps-actions');
  row.appendChild(actions);

  const renderActions = (): void => {
    const flip = el('button', 'prdeps-flip');
    flip.type = 'button';
    flip.title = blockedBy
      ? 'Blocked by (click to switch to Blocks)'
      : 'Blocks (click to switch to Blocked by)';
    flip.setAttribute('aria-label', flip.title);
    flip.innerHTML = octiconSvg('arrow-switch');
    // Flipping always rewrites the OTHER PR's body → confirm inline.
    flip.addEventListener('click', () => {
      actions.replaceChildren(
        confirmStrip(`Reverse with ${shortRef}?`, 'accent', () => { cb.onFlip(dep.ref, blockedBy); }, renderActions),
      );
    });
    actions.replaceChildren(flip);

    const removeTitle = blockedBy ? 'Remove dependency' : "Remove this PR's dependency on the current one";
    const remove = el('button', 'prdeps-remove');
    remove.type = 'button';
    remove.title = removeTitle;
    remove.setAttribute('aria-label', `${removeTitle} (${shortRef})`);
    remove.innerHTML = octiconSvg('x');
    remove.addEventListener('click', () => {
      if (blockedBy) {
        cb.onRemove(dep.ref); // own PR — no confirm needed
      } else {
        // Removing a dependent edits the OTHER PR's body → confirm inline.
        actions.replaceChildren(
          confirmStrip(`Remove from ${shortRef}?`, 'danger', () => { cb.onRemoveDependent(dep.ref); }, renderActions),
        );
      }
    });
    actions.appendChild(remove);
  };

  renderActions();
  return row;
};

const debounce = <A extends readonly unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): ((...args: A) => void) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, ms);
  };
};

const addInput = (current: PrRef, cb: BlockCallbacks): HTMLElement => {
  const wrap = el('div', 'prdeps-add');

  // Direction is a single inline pill at the end of the input; clicking it
  // flips between "Blocked by" (this PR waits on the target) and "Blocks" (the
  // target waits on this PR). One control, minimal width.
  let mode: 'blocked-by' | 'blocks' = 'blocked-by';
  const field = el('div', 'prdeps-field');
  const input = el('input', 'prdeps-input');
  input.type = 'text';
  const modeBtn = el('button', 'prdeps-modebtn');
  modeBtn.type = 'button';
  const modeLabel = el('span', 'prdeps-modebtn-label');
  modeBtn.appendChild(directionIcon());
  modeBtn.appendChild(modeLabel);
  field.appendChild(input);
  field.appendChild(modeBtn);

  const dropdown = el('div', 'prdeps-dropdown');

  const applyMode = (): void => {
    modeLabel.textContent = mode === 'blocked-by' ? 'Blocked by' : 'Blocks';
    modeBtn.classList.toggle('prdeps-modebtn--blocked-by', mode === 'blocked-by');
    modeBtn.classList.toggle('prdeps-modebtn--blocks', mode === 'blocks');
    modeBtn.title = `Switch direction (currently: ${mode === 'blocked-by' ? 'this PR is blocked by the one you add' : 'this PR blocks the one you add'})`;
    input.placeholder =
      mode === 'blocked-by'
        ? 'Add a PR this one waits on…'
        : 'Add a PR that waits on this one…';
    dropdown.replaceChildren();
  };
  modeBtn.addEventListener('click', () => {
    mode = mode === 'blocked-by' ? 'blocks' : 'blocked-by';
    applyMode();
    input.focus();
  });

  const pick = (ref: PrRef): void => {
    if (mode === 'blocked-by') cb.onAdd(ref);
    else cb.onAddBlocks(ref);
    input.value = '';
    dropdown.replaceChildren();
  };

  // A direct "Add this reference" option for a typed ref that isn't in the open
  // list — covers merged PRs and cross-repo refs (owner/repo#123) that the
  // same-repo open-PR search can't surface.
  const directOption = (ref: PrRef): HTMLElement => {
    const item = el('button', 'prdeps-option');
    item.type = 'button';
    item.appendChild(icon('git-pull-request', 'prdeps-icon'));
    item.appendChild(el('span', 'prdeps-ref', formatRefShort(ref, current)));
    item.appendChild(el('span', 'prdeps-title', 'Add this reference'));
    item.addEventListener('click', () => {
      pick(ref);
    });
    return item;
  };

  const resultOption = (r: PrSummaryWire): HTMLElement => {
    const item = el('button', `prdeps-option prdeps-row--${r.state}`);
    item.type = 'button';
    item.appendChild(icon(STATE_ICON[r.state], 'prdeps-icon'));
    item.appendChild(el('span', 'prdeps-ref', formatRefShort(r.ref, current)));
    item.appendChild(el('span', 'prdeps-title', r.title || '(untitled)'));
    item.addEventListener('click', () => {
      pick(r.ref);
    });
    return item;
  };

  // Keyboard navigation over the dropdown options.
  let activeIndex = -1;
  const options = (): readonly HTMLButtonElement[] =>
    Array.from(dropdown.querySelectorAll<HTMLButtonElement>('.prdeps-option'));
  const highlight = (idx: number): void => {
    const opts = options();
    activeIndex = idx;
    opts.forEach((o, i) => o.classList.toggle('prdeps-option--active', i === idx));
    opts[idx]?.scrollIntoView({ block: 'nearest' });
  };

  const renderResults = (query: string, results: readonly PrSummaryWire[]): void => {
    const typed = parseRef(query, current);
    const inResults = typed !== null && results.some((r) => refKey(r.ref) === refKey(typed));
    const fallback = typed !== null && !inResults ? [directOption(typed)] : [];
    dropdown.replaceChildren(...fallback, ...results.map(resultOption));
    activeIndex = -1; // results changed — reset the highlight
  };

  const runSearch = debounce((query: string): void => {
    if (query.trim() === '') {
      dropdown.replaceChildren();
      return;
    }
    void cb.onSearch(query).then((results) => {
      renderResults(query, results);
    });
  }, 200);

  input.addEventListener('input', () => {
    runSearch(input.value);
  });
  input.addEventListener('keydown', (e) => {
    const opts = options();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (opts.length > 0) highlight(Math.min(activeIndex + 1, opts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (opts.length > 0) highlight(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Escape') {
      dropdown.replaceChildren();
      activeIndex = -1;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = opts[activeIndex];
      if (active) {
        active.click(); // commit the highlighted option
        return;
      }
      const ref = parseRef(input.value, current); // else commit the typed ref
      if (ref) pick(ref);
    }
  });

  applyMode();
  wrap.appendChild(field);
  wrap.appendChild(dropdown);
  return wrap;
};

const warningBanner = (message: string): HTMLElement => {
  const line = el('div', 'prdeps-warning');
  line.appendChild(icon('alert-fill', 'prdeps-warning-icon'));
  line.appendChild(el('span', 'prdeps-warning-text', message));
  return line;
};

// Honesty about the merge-block: it's enforced only in this browser. Without
// this caveat the red button reads as a hard guarantee it isn't.
const advisoryNote = (): HTMLElement =>
  el(
    'div',
    'prdeps-advisory',
    'Enforced in your browser only. Teammates without this extension can still merge.',
  );

// Sign-in CTA: shown when the token is missing or expired. A short explanation
// plus a primary button that opens the extension settings — recoverable, not a
// red dead end like a generic error.
const authCta = (message: string, action: string, onSignIn: () => void): HTMLElement => {
  const wrap = el('div', 'prdeps-auth');
  wrap.appendChild(el('div', 'prdeps-auth-msg', message));
  const btn = el('button', 'prdeps-cta', action);
  btn.type = 'button';
  btn.addEventListener('click', onSignIn);
  wrap.appendChild(btn);
  return wrap;
};

const summaryLine = (result: ResolveResult): HTMLElement | null => {
  if (result.warning !== null) return null; // the warning banner stands in for the summary
  if (result.direct.length === 0) return null;
  const mod = result.blocked ? 'blocked' : 'clear';
  const line = el('div', `prdeps-summary prdeps-summary--${mod}`);
  line.appendChild(icon(result.blocked ? 'alert-fill' : 'check-circle-fill', 'prdeps-summary-icon'));
  const n = result.transitiveBlocking.length;
  const text = result.blocked
    ? `Blocked by ${n} pull request${n === 1 ? '' : 's'} that must merge first`
    : 'All dependencies are merged';
  line.appendChild(el('span', 'prdeps-summary-text', text));
  return line;
};

const indirectNote = (result: ResolveResult): HTMLElement | null => {
  const directKeys = new Set(result.direct.map((d) => refKey(d.ref)));
  const indirect = result.transitiveBlocking.filter((d) => !directKeys.has(refKey(d.ref)));
  if (indirect.length === 0) return null;
  const refs = indirect.map((d) => formatRefShort(d.ref, result.direct[0]?.ref ?? d.ref)).join(', ');
  return el('div', 'prdeps-indirect', `Also blocked indirectly by ${refs}`);
};

const dependentsSection = (current: PrRef, result: ResolveResult, cb: BlockCallbacks): HTMLElement | null => {
  if (result.dependents.length === 0) return null;
  const wrap = el('div', 'prdeps-dependents');
  const n = result.dependents.length;
  wrap.appendChild(
    el('div', 'prdeps-subhead', `${n} pull request${n === 1 ? '' : 's'} depend on this`),
  );
  const list = el('div', 'prdeps-list');
  result.dependents.forEach((dep) => {
    list.appendChild(relationRow(current, dep, 'blocks', cb));
  });
  wrap.appendChild(list);
  return wrap;
};

const skeleton = (): HTMLElement => {
  const list = el('div', 'prdeps-list');
  [0, 1].forEach(() => {
    const row = el('div', 'prdeps-row');
    row.appendChild(el('span', 'prdeps-skeleton prdeps-skeleton--icon'));
    row.appendChild(el('span', 'prdeps-skeleton prdeps-skeleton--text'));
    list.appendChild(row);
  });
  return list;
};

const iconMod = (state: BlockState): 'blocked' | 'clear' | 'default' | 'warning' =>
  state.kind === 'auth'
    ? 'warning'
    : state.kind === 'ready' && state.result.warning !== null
      ? 'warning'
      : state.kind === 'ready' && state.result.blocked
        ? 'blocked'
        : state.kind === 'ready'
          ? 'clear'
          : 'default';

const createIconCol = (state: BlockState): HTMLElement => {
  const col = el('div', 'prdeps-icon-col');
  col.appendChild(icon('git-pull-request', `prdeps-chain-icon prdeps-chain-icon--${iconMod(state)}`));
  return col;
};

const pill = (
  state: BlockState,
): { readonly text: string; readonly mod: string } => {
  if (state.kind === 'loading') return { text: 'Checking', mod: 'checking' };
  if (state.kind === 'auth') return { text: 'Sign in', mod: 'warning' };
  if (state.kind === 'error') return { text: 'Error', mod: 'error' };
  if (state.result.warning !== null) return { text: 'Warning', mod: 'warning' };
  return state.result.blocked ? { text: 'Blocked', mod: 'blocked' } : { text: 'Ready', mod: 'clear' };
};

export const createDependencyBlock = (
  current: PrRef,
  state: BlockState,
  cb: BlockCallbacks,
): HTMLElement => {
  const blocked = state.kind === 'ready' && state.result.blocked;
  const block = el('div', `prdeps-block${blocked ? ' prdeps-block--blocked' : ''}`);

  block.appendChild(createIconCol(state));

  const content = el('div', 'prdeps-content');

  const header = el('div', 'prdeps-header');
  header.appendChild(el('span', 'prdeps-heading', 'PR Dependencies'));
  const p = pill(state);
  header.appendChild(el('span', `prdeps-pill prdeps-pill--${p.mod}`, p.text));
  content.appendChild(header);

  if (state.kind === 'loading') {
    content.appendChild(skeleton());
    block.appendChild(content);
    return block;
  }

  if (state.kind === 'auth') {
    content.appendChild(authCta(state.message, state.action, cb.onSignIn));
    block.appendChild(content);
    return block;
  }

  if (state.kind === 'error') {
    content.appendChild(el('div', 'prdeps-error', state.message));
    block.appendChild(content);
    return block;
  }

  const { result } = state;

  if (result.warning !== null) content.appendChild(warningBanner(result.warning));

  const summary = summaryLine(result);
  if (summary) content.appendChild(summary);

  if (result.blocked) content.appendChild(advisoryNote());

  if (result.direct.length === 0) {
    content.appendChild(el('div', 'prdeps-empty', 'No dependencies yet.'));
  } else {
    const list = el('div', 'prdeps-list');
    result.direct.forEach((dep) => {
      list.appendChild(relationRow(current, dep, 'blocked-by', cb));
    });
    content.appendChild(list);
  }

  const note = indirectNote(result);
  if (note) content.appendChild(note);

  content.appendChild(addInput(current, cb));

  const dependents = dependentsSection(current, result, cb);
  if (dependents) content.appendChild(dependents);

  block.appendChild(content);
  return block;
};
