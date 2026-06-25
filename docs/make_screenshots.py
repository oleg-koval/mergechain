#!/usr/bin/env python3
"""Generate Chrome Web Store / Edge / Firefox screenshots (1280x800 PNG).

Each scene reproduces a GitHub PR page in dark theme with the *real* MergeChain
block: the CSS is read verbatim from src/content/dom.ts and the markup mirrors
src/components/dependency-block.ts, so the screenshots can't drift from the
shipped UI. Rendered with headless Chrome at 2x, downscaled to 1280x800 via sips.

Usage:  python3 docs/make_screenshots.py
Output: docs/screenshots/0N-*.png
"""
import os
import re
import shutil
import subprocess
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "screenshots")
ICON = os.path.join(ROOT, "icons", "icon-512.png")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# --- Real shipped CSS, lifted straight from the content-script source ----------
def shipped_css() -> str:
    src = open(os.path.join(ROOT, "src", "content", "dom.ts")).read()
    m = re.search(r"const CSS = `(.*?)`;", src, re.S)
    if not m:
        raise SystemExit("could not find the CSS template literal in dom.ts")
    return m.group(1)

# --- Octicons (copied verbatim from src/components/octicons.ts) -----------------
PATHS = {
    "git-pull-request": "M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z",
    "git-merge": "M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z",
    "check-circle-fill": "M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.751.751 0 0 0-.018-1.042.751.751 0 0 0-1.042-.018L6.75 9.19 5.28 7.72a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042l2 2a.75.75 0 0 0 1.06 0Z",
    "alert-fill": "M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm1 6a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z",
    "x": "M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z",
    "shield-check": "m8.533.133 5.25 1.68A1.75 1.75 0 0 1 15 3.48V7c0 1.566-.32 3.182-1.303 4.682-.983 1.498-2.585 2.813-5.032 3.855a1.697 1.697 0 0 1-1.33 0c-2.447-1.042-4.049-2.357-5.032-3.855C1.32 10.182 1 8.566 1 7V3.48a1.75 1.75 0 0 1 1.217-1.667l5.25-1.68a1.748 1.748 0 0 1 1.066 0Zm-.61 1.429.001.001-5.25 1.68a.251.251 0 0 0-.174.237V7c0 1.36.275 2.666 1.057 3.859.784 1.194 2.121 2.342 4.366 3.298a.196.196 0 0 0 .154 0c2.245-.957 3.582-2.103 4.366-3.297C13.225 9.666 13.5 8.358 13.5 7V3.48a.25.25 0 0 0-.174-.238l-5.25-1.68a.25.25 0 0 0-.153 0ZM11.28 6.28l-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l.97.97 2.97-2.97a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z",
    "arrow-up": "M3.47 7.78a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018L9 4.81v7.44a.75.75 0 0 1-1.5 0V4.81L4.53 7.78a.75.75 0 0 1-1.06 0Z",
    "arrow-down": "M13.03 8.22a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.47 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018l2.97 2.97V3.75a.75.75 0 0 1 1.5 0v7.44l2.97-2.97a.75.75 0 0 1 1.06 0Z",
    "arrow-left": "M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z",
    "arrow-right": "M8.22 2.97a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l2.97-2.97H3.75a.75.75 0 0 1 0-1.5h7.44L8.22 4.03a.75.75 0 0 1 0-1.06Z",
}

DIRECTION_SVG = (
    '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">'
    '<path class="prdeps-arrow--out" d="M10.78 8.28a.75.75 0 1 1-1.06-1.06l1.72-1.72H2.75a.75.75 0 0 1 0-1.5h8.69L9.72 2.28a.75.75 0 0 1 1.06-1.06l3 3a.75.75 0 0 1 0 1.06l-3 3Z"/>'
    '<path class="prdeps-arrow--in" d="M5.22 14.78a.75.75 0 0 0 1.06-1.06L4.56 12h8.69a.75.75 0 0 0 0-1.5H4.56l1.72-1.72a.75.75 0 0 0-1.06-1.06l-3 3a.75.75 0 0 0 0 1.06l3 3Z"/>'
    "</svg>"
)


def svg(name: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" '
        f'viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">'
        f'<path d="{PATHS[name]}"/></svg>'
    )


STATE_ICON = {"open": "git-pull-request", "merged": "git-merge", "closed": "git-pull-request"}


# --- Block fragment builders (mirror dependency-block.ts) -----------------------
def ref_link(short, title, state):
    return (
        f'<a class="prdeps-link prdeps-row--{state}" href="#">'
        f'<span class="prdeps-icon">{svg(STATE_ICON[state])}</span>'
        f'<span class="prdeps-ref">{short}</span>'
        f'<span class="prdeps-title">{title}</span></a>'
    )


def relation_row(short, title, state):
    return (
        '<div class="prdeps-row">'
        + ref_link(short, title, state)
        + '<div class="prdeps-actions">'
        + '<button class="prdeps-flip"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">'
        + '<path d="M5.22 14.78a.75.75 0 0 0 1.06-1.06L4.56 12h8.69a.75.75 0 0 0 0-1.5H4.56l1.72-1.72a.75.75 0 0 0-1.06-1.06l-3 3a.75.75 0 0 0 0 1.06l3 3Zm5.56-6.5a.75.75 0 1 1-1.06-1.06l1.72-1.72H2.75a.75.75 0 0 1 0-1.5h8.69L9.72 2.28a.75.75 0 0 1 1.06-1.06l3 3a.75.75 0 0 1 0 1.06l-3 3Z"/></svg></button>'
        + f'<button class="prdeps-remove">{svg("x")}</button>'
        + "</div></div>"
    )


def summary(blocked, n):
    mod = "blocked" if blocked else "clear"
    icon = "alert-fill" if blocked else "check-circle-fill"
    text = (
        f"Blocked by {n} pull request{'' if n == 1 else 's'} that must merge first"
        if blocked
        else "All dependencies are merged"
    )
    return (
        f'<div class="prdeps-summary prdeps-summary--{mod}">'
        f'<span class="prdeps-summary-icon">{svg(icon)}</span>'
        f'<span class="prdeps-summary-text">{text}</span></div>'
    )


ADVISORY = (
    '<div class="prdeps-advisory">Enforced in your browser only — '
    "teammates without this extension can still merge.</div>"
)


def add_input(placeholder, options_html=""):
    return (
        '<div class="prdeps-add"><div class="prdeps-field">'
        f'<input class="prdeps-input" placeholder="{placeholder}"/>'
        '<button class="prdeps-modebtn prdeps-modebtn--blocked-by">'
        f'<span class="prdeps-modebtn-icon">{DIRECTION_SVG}</span>'
        '<span class="prdeps-modebtn-label">Blocked by</span></button></div>'
        f'<div class="prdeps-dropdown">{options_html}</div></div>'
    )


def option(short, title, state="open"):
    return (
        f'<button class="prdeps-option prdeps-row--{state}">'
        f'<span class="prdeps-icon">{svg(STATE_ICON[state])}</span>'
        f'<span class="prdeps-ref">{short}</span>'
        f'<span class="prdeps-title">{title}</span></button>'
    )


def icon_col(mod):
    return (
        '<div class="prdeps-icon-col">'
        f'<span class="prdeps-chain-icon prdeps-chain-icon--{mod}">{svg("git-pull-request")}</span></div>'
    )


def header(pill_text, pill_mod):
    return (
        '<div class="prdeps-header"><span class="prdeps-heading">PR Dependencies</span>'
        f'<span class="prdeps-pill prdeps-pill--{pill_mod}">{pill_text}</span></div>'
    )


def block(icon_mod, head, body, blocked=False):
    cls = " prdeps-block--blocked" if blocked else ""
    return (
        f'<div class="prdeps-block{cls} prdeps-block--at-bottom" id="prdeps-root">'
        + icon_col(icon_mod)
        + '<div class="prdeps-content">'
        + head
        + body
        + "</div></div>"
    )


# --- Page chrome ---------------------------------------------------------------
SCENE_CSS = """
* { box-sizing: border-box; }
body { margin: 0; width: 1280px; height: 800px; overflow: hidden;
  font-family: -apple-system, 'Segoe UI', Inter, sans-serif; color: #e6edf3;
  background: radial-gradient(130% 150% at 84% -12%, #1b2444 0%, #0a0e1a 64%); }
.wrap { height: 800px; padding: 46px 72px; display: flex; flex-direction: column; gap: 26px; }
.kicker { font-size: 14px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #a78bfa; }
.headline { font-size: 35px; font-weight: 800; letter-spacing: -.9px; line-height: 1.12; margin: 6px 0 0; max-width: 980px; }
.headline .a { color: #a78bfa; }
.card { background: #0d1117; border: 1px solid #30363d; border-radius: 14px;
  box-shadow: 0 30px 70px rgba(0,0,0,.55); flex: 1; overflow: hidden;
  display: flex; flex-direction: column; }
.card-pad { padding: 26px 30px; display: flex; flex-direction: column; gap: 18px; }
.pr-title { font-size: 25px; font-weight: 600; line-height: 1.2; }
.pr-title .num { color: #8b949e; font-weight: 300; }
.pr-meta { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #8b949e; }
.open-badge { display: inline-flex; align-items: center; gap: 6px; background: #238636; color: #fff;
  font-size: 13px; font-weight: 600; padding: 5px 12px; border-radius: 999px; }
.branch { font-family: ui-monospace, monospace; font-size: 12.5px; background: rgba(31,111,235,.18);
  color: #6cb6ff; padding: 2px 8px; border-radius: 6px; }
.mergebox { border: 1px solid #30363d; border-radius: 8px; background: #161b22; padding: 16px 18px;
  display: flex; align-items: center; gap: 16px; }
.mergebox .ico { width: 30px; height: 30px; border-radius: 999px; flex-shrink: 0; display: flex;
  align-items: center; justify-content: center; }
.mergebox .ico.red { background: rgba(248,81,73,.15); color: #f85149; }
.mergebox .ico.green { background: rgba(63,185,80,.15); color: #3fb950; }
.merge-state { flex: 1; }
.merge-state h3 { margin: 0 0 2px; font-size: 15px; font-weight: 600; }
.merge-state p { margin: 0; font-size: 13px; color: #8b949e; }
.btn-merge { font-size: 14px; font-weight: 600; padding: 9px 18px; border-radius: 6px;
  border: 1px solid rgba(240,246,252,.1); background: #238636; color: #fff; }
"""


def pr_card(title, num, branch_from, block_html, merge_html):
    return f"""<div class="wrap">
  <div>
    <div class="kicker">$KICKER</div>
    <h1 class="headline">$HEADLINE</h1>
  </div>
  <div class="card"><div class="card-pad">
    <div class="pr-title">{title} <span class="num">#{num}</span></div>
    <div class="pr-meta"><span class="open-badge">{svg('git-pull-request')} Open</span>
      <span>wants to merge into <span class="branch">main</span> from <span class="branch">{branch_from}</span></span></div>
    {block_html}
    {merge_html}
  </div></div>
</div>"""


def merge_box(blocked):
    if blocked:
        return (
            '<div class="mergebox"><div class="ico red">' + svg("alert-fill") + "</div>"
            '<div class="merge-state"><h3>Merging is blocked</h3>'
            "<p>A required dependency hasn’t been merged yet.</p></div>"
            '<button class="btn-merge prdeps-merge-blocked">Merge pull request</button></div>'
        )
    return (
        '<div class="mergebox"><div class="ico green">' + svg("check-circle-fill") + "</div>"
        '<div class="merge-state"><h3>This branch has no conflicts with the base branch</h3>'
        "<p>All dependencies merged — merging can be performed automatically.</p></div>"
        '<button class="btn-merge">Merge pull request</button></div>'
    )


def page(inner, extra_css=""):
    return (
        "<!doctype html><html><head><meta charset='utf-8'><style>"
        + shipped_css()
        + SCENE_CSS
        + extra_css
        # Freeze animations/transitions so the single captured frame is final
        # (the block otherwise fades in from opacity:0).
        + " * { animation: none !important; transition: none !important; }"
        + "</style></head><body>"
        + inner
        + "</body></html>"
    )


# --- Scenes --------------------------------------------------------------------
def scene_blocked():
    body = (
        summary(True, 2)
        + ADVISORY
        + '<div class="prdeps-list">'
        + relation_row("#126", "Add auth middleware", "open")
        + relation_row("api-core#84", "Rotate service tokens", "open")
        + "</div>"
        + '<div class="prdeps-indirect">Also blocked indirectly by #99</div>'
        + add_input("Add a PR this one waits on…")
    )
    blk = block("blocked", header("Blocked", "blocked"), body, blocked=True)
    inner = pr_card("Add rate limiter to API gateway", 128, "feat/rate-limit", blk, merge_box(True))
    return inner, "Stop merging GitHub PRs <span class='a'>out of order</span>", "Merge dependencies"


def scene_clear():
    body = (
        summary(False, 0)
        + '<div class="prdeps-list">'
        + relation_row("#126", "Add auth middleware", "merged")
        + relation_row("#131", "Wire config flags", "merged")
        + "</div>"
        + add_input("Add a PR this one waits on…")
    )
    blk = block("clear", header("Ready", "clear"), body)
    inner = pr_card("Add rate limiter to API gateway", 128, "feat/rate-limit", blk, merge_box(False))
    return inner, "The merge unblocks the moment its <span class='a'>dependencies land</span>", "Automatic"


def scene_declare():
    opts = option("#131", "Rate limit config", "open") + option("#118", "Redis client pool", "open") + option("#84", "Rotate service tokens", "open")
    body = (
        '<div class="prdeps-empty">No dependencies yet.</div>'
        + add_input("Add a PR this one waits on…", opts)
    )
    blk = block("default", header("Ready", "clear"), body)
    inner = pr_card("Add rate limiter to API gateway", 128, "feat/rate-limit", blk, merge_box(False))
    return inner, "Declare a dependency in one click — <span class='a'>blocked-by or blocks</span>", "One click"


def scene_chain():
    body = (
        summary(True, 2)
        + ADVISORY
        + '<div class="prdeps-list">'
        + relation_row("#126", "Add auth middleware", "open")
        + "</div>"
        + '<div class="prdeps-indirect">Also blocked indirectly by api-core#84</div>'
        + add_input("Add a PR this one waits on…")
        + '<div class="prdeps-dependents"><div class="prdeps-subhead">2 pull requests depend on this</div>'
        + '<div class="prdeps-list">'
        + relation_row("#140", "Dashboard charts", "open")
        + relation_row("#141", "Usage export job", "open")
        + "</div></div>"
    )
    blk = block("blocked", header("Blocked", "blocked"), body, blocked=True)
    inner = pr_card("Add rate limiter to API gateway", 128, "feat/rate-limit", blk, merge_box(True))
    return inner, "See the whole chain — <span class='a'>transitive, cross-repo, both directions</span>", "Full graph"


TRUST_CSS = """
.trust { height: 800px; padding: 70px 90px; display: flex; flex-direction: column; gap: 34px; }
.trust .headline { font-size: 44px; max-width: 1000px; }
.chips { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 4px; }
.chip { display: flex; align-items: center; gap: 11px; background: #0d1117; border: 1px solid #30363d;
  border-radius: 12px; padding: 16px 20px; font-size: 16px; font-weight: 600; }
.chip .g { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  background: rgba(167,139,250,.16); color: #a78bfa; flex-shrink: 0; }
.chip .g svg { width: 18px; height: 18px; }
.popup { align-self: flex-start; margin-top: 10px; width: 268px; background: #161b22; border: 1px solid #30363d;
  border-radius: 14px; padding: 16px; box-shadow: 0 24px 60px rgba(0,0,0,.5); }
.popup h2 { font-size: 13px; font-weight: 600; margin: 0 0 12px; }
.pad { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.pad .t { grid-column: 2; grid-row: 1; } .pad .l { grid-column: 1; grid-row: 2; }
.pad .c { grid-column: 2; grid-row: 2; display: flex; align-items: center; justify-content: center; color: #8b949e; }
.pad .r { grid-column: 3; grid-row: 2; } .pad .b { grid-column: 2; grid-row: 3; }
.pos { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 9px 4px;
  font-size: 11px; font-weight: 600; border: 1px solid #30363d; border-radius: 9px; background: transparent; color: #8b949e; }
.pos svg { width: 16px; height: 16px; fill: currentColor; }
.pos.on { border-color: #2f81f7; color: #2f81f7; background: rgba(47,129,247,.12); }
"""


def chip(icon, text):
    return f'<div class="chip"><span class="g">{svg(icon)}</span>{text}</div>'


def pos(kind, label, on=False):
    return f'<button class="pos {"on" if on else ""}">{svg(kind)}<span>{label}</span></button>'


def scene_trust():
    pad = (
        f'<div class="pad"><div class="t">{pos("arrow-up","Top",True)}</div>'
        f'<div class="l">{pos("arrow-left","Left")}</div>'
        f'<div class="c">{svg("git-pull-request")}</div>'
        f'<div class="r">{pos("arrow-right","Right")}</div>'
        f'<div class="b">{pos("arrow-down","Bottom")}</div></div>'
    )
    inner = f"""<div class="trust">
  <div>
    <div class="kicker">Private by design</div>
    <h1 class="headline">No backend. Your token never<br/>leaves your <span class="a">browser</span>.</h1>
  </div>
  <div class="chips">
    {chip("shield-check", "Dependencies stored in the PR body")}
    {chip("shield-check", "GitHub token stays on your machine")}
    {chip("shield-check", "Your whole team sees the same chain")}
  </div>
  <div class="popup"><h2>Dependency block position</h2>{pad}</div>
</div>"""
    return inner, None, None


SCENES = [
    ("01-blocked", scene_blocked),
    ("02-unblocks", scene_clear),
    ("03-declare", scene_declare),
    ("04-chain", scene_chain),
    ("05-private", scene_trust),
]


def render(name, html):
    os.makedirs(OUT, exist_ok=True)
    html_path = os.path.join(OUT, name + ".html")
    png_path = os.path.join(OUT, name + ".png")
    open(html_path, "w").write(html)
    # MC_HTML_ONLY=1 emits just the HTML (for machines where headless Chrome
    # hangs — render the files with another tool, e.g. gstack `browse`:
    #   browse viewport 1280x800 --scale 2
    #   browse goto file://<abs>.html && browse screenshot <abs>.png
    #   sips -z 800 1280 <abs>.png).
    if os.environ.get("MC_HTML_ONLY") == "1":
        print(f"  {name}.html")
        return
    # A throwaway profile per render — headless=new otherwise fights the user's
    # already-open Chrome for the default profile lock and hangs.
    profile = tempfile.mkdtemp(prefix="mc-shot-")
    try:
        # --headless=old is the reliable screenshot path; --headless=new + virtual
        # time budget hangs here. Animations are disabled in CSS (see page()) so the
        # single captured frame is already settled.
        subprocess.run(
            [
                CHROME, "--headless=old", "--disable-gpu", "--no-first-run",
                "--no-default-browser-check", "--hide-scrollbars",
                f"--user-data-dir={profile}",
                "--force-device-scale-factor=2", "--window-size=1280,800",
                f"--screenshot={png_path}", "file://" + html_path,
            ],
            check=True, capture_output=True, timeout=60,
        )
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    # 2x capture -> downscale to exactly 1280x800.
    subprocess.run(["sips", "-z", "800", "1280", png_path], check=True, capture_output=True)
    os.remove(html_path)
    w = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", png_path],
                       capture_output=True, text=True).stdout.strip().split()
    print(f"  {name}.png  {w[-3]}x{w[-1]}")


def main():
    print("Rendering screenshots ->", OUT)
    for name, fn in SCENES:
        inner, headline, kicker = fn()
        if headline is not None:
            inner = inner.replace("$KICKER", kicker).replace("$HEADLINE", headline)
        extra = TRUST_CSS if name == "05-private" else ""
        render(name, page(inner, extra))
    print("done.")


if __name__ == "__main__":
    main()
