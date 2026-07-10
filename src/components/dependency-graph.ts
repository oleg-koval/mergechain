import type { GraphNode, GraphView } from '../messages.js';
import type { PrRef, PrState } from '../types/index.js';
import { formatRefShort, prUrl, refEquals } from '../lib/pr-ref.js';
import { layoutGraph, type LaidEdge, type LaidNode, type LaidOutGraph } from '../lib/graph-layout.js';
import { octiconSvg, type OcticonName } from './octicons.js';

// Graph view of the dependency neighborhood. HTML node pills laid over an SVG
// edge layer: edges get SVG's curves + arrowheads, while nodes stay plain <a>
// elements so they reuse the octicon vocabulary, theming, and click behaviour
// of the list view. Layout math lives in the pure core (graph-layout.ts).

// Local copy of the list view's state → octicon map (kept here to avoid a
// components ↔ components import cycle with dependency-block.ts).
const STATE_ICON: Record<PrState, OcticonName> = {
  open: 'git-pull-request',
  merged: 'git-merge',
  closed: 'git-pull-request-closed',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
  document.createElementNS(SVG_NS, tag);

// A horizontal-flow cubic Bézier: leaves the source's right edge and enters the
// target's left edge, so crossing edges read as smooth curves rather than a
// tangle of straight lines.
const edgePath = (e: LaidEdge): string => {
  const dx = Math.max(e.x2 - e.x1, 24);
  const c1 = e.x1 + dx * 0.5;
  const c2 = e.x2 - dx * 0.5;
  return `M${e.x1},${e.y1} C${c1},${e.y1} ${c2},${e.y2} ${e.x2},${e.y2}`;
};

// Two arrowhead markers (muted + danger) so blocking edges point with the same
// colour they're drawn in. Markers can't inherit currentColor across the <use>
// boundary reliably, so each has its own class the stylesheet colours.
const arrowMarker = (id: string, cls: string): SVGMarkerElement => {
  const marker = svgEl('marker');
  marker.setAttribute('id', id);
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '8');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('orient', 'auto-start-reverse');
  const path = svgEl('path');
  path.setAttribute('d', 'M0,0 L10,5 L0,10 z');
  path.setAttribute('class', cls);
  marker.appendChild(path);
  return marker;
};

const MARKER_MUTED = 'prdeps-arrow-muted';
const MARKER_DANGER = 'prdeps-arrow-danger';

const edgeLayer = (width: number, height: number, edges: readonly LaidEdge[]): SVGSVGElement => {
  const svg = svgEl('svg');
  svg.setAttribute('class', 'prdeps-graph-edges');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');

  const defs = svgEl('defs');
  defs.appendChild(arrowMarker(MARKER_MUTED, 'prdeps-arrowhead'));
  defs.appendChild(arrowMarker(MARKER_DANGER, 'prdeps-arrowhead prdeps-arrowhead--blocking'));
  svg.appendChild(defs);

  edges.forEach((e) => {
    const path = svgEl('path');
    path.setAttribute('d', edgePath(e));
    path.setAttribute('class', `prdeps-edge${e.blocking ? ' prdeps-edge--blocking' : ''}`);
    path.setAttribute('marker-end', `url(#${e.blocking ? MARKER_DANGER : MARKER_MUTED})`);
    svg.appendChild(path);
  });
  return svg;
};

// One node pill. The root (this PR) is a non-navigating <div>; every other node
// links to its PR. State + blocking status drive the classes the sheet colours.
const nodeEl = (current: PrRef, laid: LaidNode): HTMLElement => {
  const n: GraphNode = laid.node;
  const isRoot = n.role === 'root' || refEquals(n.ref, current);
  const cls =
    `prdeps-gnode prdeps-gnode--${n.state}` +
    (isRoot ? ' prdeps-gnode--root' : '') +
    (n.blocking ? ' prdeps-gnode--blocking' : '');

  const node = isRoot ? document.createElement('div') : document.createElement('a');
  node.className = cls;
  if (node instanceof HTMLAnchorElement) node.href = prUrl(n.ref);
  node.style.left = `${laid.x}px`;
  node.style.top = `${laid.y}px`;
  node.style.width = `${laid.w}px`;
  node.style.height = `${laid.h}px`;
  node.title = `${formatRefShort(n.ref, current)} ${n.title}`.trim();

  const ico = document.createElement('span');
  ico.className = 'prdeps-icon';
  ico.innerHTML = octiconSvg(STATE_ICON[n.state]);
  node.appendChild(ico);

  const ref = document.createElement('span');
  ref.className = 'prdeps-gref';
  ref.textContent = formatRefShort(n.ref, current);
  node.appendChild(ref);

  const title = document.createElement('span');
  title.className = 'prdeps-gtitle';
  title.textContent = n.title || '(untitled)';
  node.appendChild(title);

  return node;
};

/**
 * Build the Graph view element for a resolved neighborhood. Returns `null` when
 * the graph is too large to draw meaningfully — the caller then keeps the list
 * and surfaces the count, so nothing is silently dropped.
 */
export const createDependencyGraph = (current: PrRef, graph: GraphView): HTMLElement | null => {
  const laid: LaidOutGraph = layoutGraph(graph);
  if (laid.tooLarge) return null;

  const wrap = document.createElement('div');
  wrap.className = 'prdeps-graph';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'PR dependency graph');

  const canvas = document.createElement('div');
  canvas.className = 'prdeps-graph-canvas';
  canvas.style.width = `${laid.width}px`;
  canvas.style.height = `${laid.height}px`;

  canvas.appendChild(edgeLayer(laid.width, laid.height, laid.edges));
  laid.nodes.forEach((node) => canvas.appendChild(nodeEl(current, node)));

  wrap.appendChild(canvas);
  return wrap;
};
