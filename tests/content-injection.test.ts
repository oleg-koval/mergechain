// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrRef } from '../src/types/index.js';
import type { GraphView, ResolveResult } from '../src/messages.js';
import {
  findMergeArea,
  findMergeButtons,
  mountBlock,
  setMergeBlocked,
  blockExists,
} from '../src/content/dom.js';
import { createDependencyBlock, type BlockCallbacks } from '../src/components/dependency-block.js';

// Validates the DOM-injection boundary against a fixture that mirrors GitHub's
// current merge box markup. This is the deterministic stand-in for a live
// browser test: it proves the selectors match, the block mounts above the merge
// area, and the merge button is turned red + disabled when blocked.

const current: PrRef = { owner: 'oleg-koval', repo: 'pr-deps-e2e', number: 2 };

// Empty neighborhood: with ≤1 node the block never offers the Graph toggle, so
// the list-view assertions below are unaffected.
const noGraph: GraphView = { nodes: [], edges: [], root: current };

const noopCb: BlockCallbacks = {
  onSearch: () => Promise.resolve([]),
  onAdd: () => undefined,
  onAddBlocks: () => undefined,
  onRemove: () => undefined,
  onRemoveDependent: () => undefined,
  onFlip: () => undefined,
  onSignIn: () => undefined,
  onToggleView: () => undefined,
};

const mergeBoxFixture = (): void => {
  document.body.innerHTML = `
    <div id="pr-container">
      <div data-testid="mergebox-partial">
        <h3>Merging is blocked</h3>
        <button type="button">Merge pull request</button>
      </div>
    </div>`;
};

describe('content DOM injection', () => {
  beforeEach(() => {
    mergeBoxFixture();
  });

  it('locates the merge area and its merge button', () => {
    expect(findMergeArea()).not.toBeNull();
    const buttons = findMergeButtons();
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toContain('Merge pull request');
  });

  it('mounts the block immediately above the merge area', () => {
    const area = findMergeArea();
    const block = createDependencyBlock(current, { kind: 'loading' }, noopCb);
    expect(mountBlock(block, 'bottom')).toBe(true);
    expect(blockExists()).toBe(true);
    // The block sits right before the merge area, sharing its parent.
    expect(block.nextElementSibling).toBe(area);
    expect(document.getElementById('pr-container')?.firstElementChild?.id).toBe('prdeps-root');
  });

  it('remounting replaces the existing block (no duplicates)', () => {
    mountBlock(createDependencyBlock(current, { kind: 'loading' }, noopCb), 'bottom');
    mountBlock(createDependencyBlock(current, { kind: 'loading' }, noopCb), 'bottom');
    expect(document.querySelectorAll('#prdeps-root')).toHaveLength(1);
  });

  it('turns the merge button red and blocked when blocked, then restores it', () => {
    setMergeBlocked(true, 'Blocked: #1 must be merged first');
    const btn = findMergeButtons()[0];
    // Native `disabled` must stay false: setting it would drop the button out
    // of the tab order, so keyboard/SR users could never reach it or hear why
    // it's blocked. Activation is intercepted (see below) instead.
    expect(btn?.disabled).toBe(false);
    expect(btn?.getAttribute('aria-disabled')).toBe('true');
    expect(btn?.classList.contains('prdeps-merge-blocked')).toBe(true);
    expect(btn?.getAttribute('title')).toBe('Blocked: #1 must be merged first');
    // The visible label switches to a short blocked message; the full reason
    // stays available to screen readers via aria-label.
    expect(btn?.textContent).toBe('Waiting on deps');
    expect(btn?.getAttribute('aria-label')).toBe('Blocked: #1 must be merged first');

    const clickEvent = new MouseEvent('click', { cancelable: true, bubbles: true });
    btn?.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(true);

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
    btn?.dispatchEvent(enterEvent);
    expect(enterEvent.defaultPrevented).toBe(true);

    setMergeBlocked(false, '');
    expect(btn?.disabled).toBe(false);
    expect(btn?.getAttribute('aria-disabled')).toBe(null);
    expect(btn?.getAttribute('title')).toBe(null);
    expect(btn?.getAttribute('aria-label')).toBe(null);
    expect(btn?.classList.contains('prdeps-merge-blocked')).toBe(false);
    // The native label is restored verbatim.
    expect(btn?.textContent).toBe('Merge pull request');

    // Activation must no longer be intercepted once unblocked.
    const clickAfter = new MouseEvent('click', { cancelable: true, bubbles: true });
    btn?.dispatchEvent(clickAfter);
    expect(clickAfter.defaultPrevented).toBe(false);
  });

  it('clicking the blocked merge button reveals (focuses + flashes) the dependency block', () => {
    mountBlock(createDependencyBlock(current, { kind: 'loading' }, noopCb), 'bottom');
    setMergeBlocked(true, 'Blocked: #1 must be merged first');
    findMergeButtons()[0]?.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));
    const block = document.getElementById('prdeps-root');
    expect(block?.classList.contains('prdeps-block--flash')).toBe(true);
    expect(block?.getAttribute('tabindex')).toBe('-1');
  });

  it('renders a blocked block with a clickable dep row, blocked pill, and summary', () => {
    const result: ResolveResult = {
      blocked: true,
      direct: [
        { ref: { owner: 'oleg-koval', repo: 'pr-deps-e2e', number: 1 }, title: 'PR A: base feature', state: 'open', blocking: true },
      ],
      transitiveBlocking: [
        { ref: { owner: 'oleg-koval', repo: 'pr-deps-e2e', number: 1 }, title: 'PR A: base feature', state: 'open', blocking: true },
      ],
      dependents: [],
      graph: noGraph,
      warning: null,
    };
    const block = createDependencyBlock(current, { kind: 'ready', result }, noopCb);

    expect(block.classList.contains('prdeps-block--blocked')).toBe(true);
    expect(block.querySelector('.prdeps-pill--blocked')).not.toBeNull();
    // No Teifi branding anywhere in the block.
    expect(block.querySelector('.prdeps-badge')).toBeNull();
    // Summary line mirrors GitHub's phrasing.
    expect(block.querySelector('.prdeps-summary--blocked')?.textContent).toContain(
      'Blocked by 1 pull request',
    );
    // The dep row is a real link to the PR.
    const link = block.querySelector<HTMLAnchorElement>('.prdeps-link');
    expect(link?.getAttribute('href')).toBe('https://github.com/oleg-koval/pr-deps-e2e/pull/1');
    expect(link?.textContent).toContain('#1');
    expect(link?.textContent).toContain('PR A: base feature');
  });

  it('renders a clear block when nothing is blocking', () => {
    const result: ResolveResult = { blocked: false, direct: [], transitiveBlocking: [], dependents: [], graph: noGraph, warning: null };
    const block = createDependencyBlock(current, { kind: 'ready', result }, noopCb);
    expect(block.classList.contains('prdeps-block--blocked')).toBe(false);
    expect(block.querySelector('.prdeps-pill--clear')).not.toBeNull();
    expect(block.querySelector('.prdeps-empty')?.textContent).toContain('No dependencies');
  });

  it('renders a reverse-dependents section when other PRs depend on this one', () => {
    const result: ResolveResult = {
      blocked: false,
      direct: [],
      transitiveBlocking: [],
      dependents: [
        { ref: { owner: 'oleg-koval', repo: 'pr-deps-e2e', number: 5 }, title: 'PR E depends on us', state: 'open', blocking: false },
      ],
      graph: noGraph,
      warning: null,
    };
    const block = createDependencyBlock(current, { kind: 'ready', result }, noopCb);
    const section = block.querySelector('.prdeps-dependents');
    expect(section).not.toBeNull();
    expect(section?.querySelector('.prdeps-subhead')?.textContent).toContain('1 pull request depend');
    expect(section?.querySelector<HTMLAnchorElement>('.prdeps-link')?.getAttribute('href')).toBe(
      'https://github.com/oleg-koval/pr-deps-e2e/pull/5',
    );
    // A dependent can be cleared from here too (edits the other PR's body).
    expect(section?.querySelector('.prdeps-remove')).not.toBeNull();
  });

  it('shows a non-blocking warning (with deps still listed) instead of wiping the block', () => {
    const result: ResolveResult = {
      blocked: false,
      direct: [
        { ref: { owner: 'oleg-koval', repo: 'pr-deps-e2e', number: 3 }, title: 'PR C', state: 'open', blocking: false },
      ],
      transitiveBlocking: [],
      dependents: [],
      graph: noGraph,
      warning: 'Dependency cycle detected — remove one of the dependencies below to break it.',
    };
    const block = createDependencyBlock(current, { kind: 'ready', result }, noopCb);
    // Warning shown, not the merge-blocking state.
    expect(block.classList.contains('prdeps-block--blocked')).toBe(false);
    expect(block.querySelector('.prdeps-pill--warning')).not.toBeNull();
    expect(block.querySelector('.prdeps-warning')?.textContent).toContain('cycle detected');
    // The dep is still listed with a remove button so the user can fix it.
    expect(block.querySelector('.prdeps-link')?.textContent).toContain('#3');
    expect(block.querySelector('.prdeps-remove')).not.toBeNull();
  });

  it('renders a sign-in CTA (not a dead-end error) for an auth state', () => {
    let signedIn = 0;
    const cb: BlockCallbacks = { ...noopCb, onSignIn: () => { signedIn += 1; } };
    const block = createDependencyBlock(
      current,
      { kind: 'auth', message: 'Your GitHub sign-in expired. Re-authenticate to keep dependencies working.', action: 'Re-authenticate' },
      cb,
    );

    // "Sign in" pill, not the red "Error" one.
    expect(block.querySelector('.prdeps-pill')?.textContent).toBe('Sign in');
    expect(block.querySelector('.prdeps-error')).toBeNull();

    // The message and a clickable CTA that fires onSignIn.
    expect(block.querySelector('.prdeps-auth-msg')?.textContent).toContain('Re-authenticate');
    const cta = block.querySelector<HTMLButtonElement>('.prdeps-cta');
    expect(cta?.textContent).toBe('Re-authenticate');
    cta?.click();
    expect(signedIn).toBe(1);
  });

  it('routes adds through onAdd or onAddBlocks based on the direction toggle', () => {
    const added: PrRef[] = [];
    const blocks: PrRef[] = [];
    const cb: BlockCallbacks = {
      onSearch: () => Promise.resolve([]),
      onAdd: (r) => {
        added.push(r);
      },
      onAddBlocks: (r) => {
        blocks.push(r);
      },
      onRemove: () => undefined,
      onRemoveDependent: () => undefined,
      onFlip: () => undefined,
      onSignIn: () => undefined,
      onToggleView: () => undefined,
    };
    const result: ResolveResult = { blocked: false, direct: [], transitiveBlocking: [], dependents: [], graph: noGraph, warning: null };
    const block = createDependencyBlock(current, { kind: 'ready', result }, cb);
    const input = block.querySelector<HTMLInputElement>('.prdeps-input');
    const modeBtn = block.querySelector<HTMLButtonElement>('.prdeps-modebtn');
    expect(input).not.toBeNull();
    expect(modeBtn).not.toBeNull();
    if (!input || !modeBtn) return;

    const enter = (value: string): void => {
      input.value = value;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    };

    // Default mode is "Blocked by" → onAdd.
    expect(modeBtn.textContent).toContain('Blocked by');
    enter('#7');
    expect(added.map((r) => r.number)).toEqual([7]);
    expect(blocks).toHaveLength(0);

    // Click flips to "Blocks" → onAddBlocks.
    modeBtn.click();
    expect(modeBtn.textContent).toContain('Blocks');
    enter('#8');
    expect(blocks.map((r) => r.number)).toEqual([8]);
    expect(added.map((r) => r.number)).toEqual([7]);
  });

  it('keyboard: ArrowDown highlights a dropdown option and Enter commits it', async () => {
    const added: number[] = [];
    const cb: BlockCallbacks = {
      ...noopCb,
      onSearch: () =>
        Promise.resolve([
          { ref: { owner: 'oleg-koval', repo: 'pr-deps-e2e', number: 11 }, title: 'Eleven', state: 'open' },
        ]),
      onAdd: (r) => {
        added.push(r.number);
      },
    };
    const result: ResolveResult = { blocked: false, direct: [], transitiveBlocking: [], dependents: [], graph: noGraph, warning: null };
    const block = createDependencyBlock(current, { kind: 'ready', result }, cb);
    const input = block.querySelector<HTMLInputElement>('.prdeps-input');
    expect(input).not.toBeNull();
    if (!input) return;

    vi.useFakeTimers();
    input.value = 'Eleven';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(250); // past the 200ms debounce + resolve onSearch
    vi.useRealTimers();

    expect(block.querySelectorAll('.prdeps-option')).toHaveLength(1);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(block.querySelector('.prdeps-option--active')).not.toBeNull();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(added).toEqual([11]);
  });

  it('each row has a flip button that reverses the edge with the right direction', () => {
    const flips: { ref: number; blockedBy: boolean }[] = [];
    const cb: BlockCallbacks = {
      ...noopCb,
      onFlip: (other, blockedBy) => {
        flips.push({ ref: other.number, blockedBy });
      },
    };
    const result: ResolveResult = {
      blocked: false,
      direct: [
        { ref: { owner: 'oleg-koval', repo: 'pr-deps-e2e', number: 1 }, title: 'A', state: 'open', blocking: false },
      ],
      transitiveBlocking: [],
      dependents: [
        { ref: { owner: 'oleg-koval', repo: 'pr-deps-e2e', number: 5 }, title: 'E', state: 'open', blocking: false },
      ],
      graph: noGraph,
      warning: null,
    };
    const block = createDependencyBlock(current, { kind: 'ready', result }, cb);
    const rows = Array.from(block.querySelectorAll<HTMLElement>('.prdeps-row'));
    // One flip button on the direct dep row, one on the dependent row.
    expect(block.querySelectorAll('.prdeps-flip')).toHaveLength(2);

    // Clicking flip shows an inline confirm (no callback yet), Confirm commits.
    const confirmFlip = (rowIdx: number): void => {
      rows[rowIdx]?.querySelector<HTMLButtonElement>('.prdeps-flip')?.click();
      rows[rowIdx]?.querySelector<HTMLButtonElement>('.prdeps-confirm-yes')?.click();
    };
    confirmFlip(0); // direct dep #1 → currently "blocked by"
    confirmFlip(1); // dependent #5 → currently "blocks"
    expect(flips).toEqual([
      { ref: 1, blockedBy: true },
      { ref: 5, blockedBy: false },
    ]);
  });

  it('inline confirm can be cancelled without firing the callback', () => {
    let flipped = false;
    const cb: BlockCallbacks = { ...noopCb, onFlip: () => { flipped = true; } };
    const result: ResolveResult = {
      blocked: false,
      direct: [{ ref: { owner: 'oleg-koval', repo: 'pr-deps-e2e', number: 1 }, title: 'A', state: 'open', blocking: false }],
      transitiveBlocking: [],
      dependents: [],
      graph: noGraph,
      warning: null,
    };
    const block = createDependencyBlock(current, { kind: 'ready', result }, cb);
    block.querySelector<HTMLButtonElement>('.prdeps-flip')?.click();
    expect(block.querySelector('.prdeps-confirm')).not.toBeNull();
    block.querySelector<HTMLButtonElement>('.prdeps-confirm-no')?.click();
    expect(flipped).toBe(false);
    // Cancel restores the action buttons.
    expect(block.querySelector('.prdeps-confirm')).toBeNull();
    expect(block.querySelector('.prdeps-flip')).not.toBeNull();
  });

  // A three-node neighborhood: #1 (merged) → this PR (#2) → #5 (open dependent).
  const graphResult = (): ResolveResult => {
    const dep: PrRef = { owner: 'oleg-koval', repo: 'pr-deps-e2e', number: 1 };
    const dependent: PrRef = { owner: 'oleg-koval', repo: 'pr-deps-e2e', number: 5 };
    const graph: GraphView = {
      root: current,
      nodes: [
        { ref: dep, title: 'Base', state: 'merged', role: 'upstream', blocking: false },
        { ref: current, title: 'This PR', state: 'open', role: 'root', blocking: false },
        { ref: dependent, title: 'Waits on us', state: 'open', role: 'downstream', blocking: false },
      ],
      edges: [
        { from: dep, to: current },
        { from: current, to: dependent },
      ],
    };
    return {
      blocked: false,
      direct: [{ ref: dep, title: 'Base', state: 'merged', blocking: false }],
      transitiveBlocking: [],
      dependents: [{ ref: dependent, title: 'Waits on us', state: 'open', blocking: false }],
      graph,
      warning: null,
    };
  };

  it('offers the List | Graph toggle only once there is a relationship to draw', () => {
    const graphable = createDependencyBlock(current, { kind: 'ready', result: graphResult() }, noopCb);
    expect(graphable.querySelectorAll('.prdeps-viewbtn')).toHaveLength(2);
    // A lone PR (empty neighborhood) offers no toggle.
    const empty: ResolveResult = { blocked: false, direct: [], transitiveBlocking: [], dependents: [], graph: noGraph, warning: null };
    const bare = createDependencyBlock(current, { kind: 'ready', result: empty }, noopCb);
    expect(bare.querySelector('.prdeps-viewtoggle')).toBeNull();
  });

  it('the toggle asks the content script to switch view', () => {
    const seen: string[] = [];
    const cb: BlockCallbacks = { ...noopCb, onToggleView: (v) => seen.push(v) };
    const block = createDependencyBlock(current, { kind: 'ready', result: graphResult() }, cb);
    // Currently on List → clicking Graph requests 'graph'; clicking List (active) is a no-op.
    const [listBtn, graphBtn] = Array.from(block.querySelectorAll<HTMLButtonElement>('.prdeps-viewbtn'));
    graphBtn?.click();
    listBtn?.click();
    expect(seen).toEqual(['graph']);
  });

  it('graph view swaps the list for an SVG diagram with clickable, non-root nodes', () => {
    const block = createDependencyBlock(current, { kind: 'ready', result: graphResult() }, noopCb, 'graph');
    // List view widgets are gone; the graph is present.
    expect(block.querySelector('.prdeps-list')).toBeNull();
    expect(block.querySelector('.prdeps-add')).toBeNull();
    expect(block.querySelector('.prdeps-graph-edges')).not.toBeNull();
    // Three nodes; the two non-root ones are links, the root is not.
    expect(block.querySelectorAll('.prdeps-gnode')).toHaveLength(3);
    expect(block.querySelector('.prdeps-gnode--root')?.tagName).toBe('DIV');
    const links = Array.from(block.querySelectorAll<HTMLAnchorElement>('a.prdeps-gnode'));
    expect(links).toHaveLength(2);
    expect(links.map((a) => a.getAttribute('href'))).toContain(
      'https://github.com/oleg-koval/pr-deps-e2e/pull/1',
    );
    // The heading/pill still frame the diagram.
    expect(block.querySelector('.prdeps-heading')?.textContent).toBe('PR Dependencies');
  });
});
