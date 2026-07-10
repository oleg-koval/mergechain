"""Chrome Web Store Marquee promo tile (1400×560) — Pillow only, no browser."""
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ICON = os.path.join(HERE, "..", "icons", "icon-512.png")
OUT  = os.path.join(HERE, "promo-tile-marquee.png")

W, H   = 1400, 560
SCALE  = 3
w, h   = W * SCALE, H * SCALE

NAVY      = (10,  14,  26)
NAVY_HI   = (27,  36,  68)
NAVY_CARD = (16,  22,  40)
WHITE     = (230, 237, 243)
PURPLE    = (167, 139, 250)
GRAY      = (154, 164, 178)
GRAY_DIM  = (90,  100, 115)
TEAL      = (52,  211, 153)
TEAL_DIM  = (30,  120,  88)
TEAL_DARK = (6,   40,  30)
RED_SOFT  = (248, 113, 113)
RED_DIM   = (140,  50,  50)
CARD_BDR  = (38,  48,  85)
CARD_BDR2 = (80,  40,  40)
DOT_GREEN = (74,  222, 128)
DOT_RED   = (248, 113, 113)

SF   = "/System/Library/Fonts/SFNS.ttf"
HELV = "/System/Library/Fonts/Helvetica.ttc"


def font(size, bold=False):
    try:
        return ImageFont.truetype(HELV, size, index=(1 if bold else 0))
    except Exception:
        return ImageFont.load_default()


def radial_bg(size):
    bw, bh = size
    bg  = Image.new("RGB", size, NAVY)
    px  = bg.load()
    cx, cy = bw * 0.72, bh * -0.05
    maxd   = (bw**2 + bh**2) ** 0.5
    for y in range(bh):
        for x in range(bw):
            d = ((x - cx)**2 + (y - cy)**2) ** 0.5 / maxd
            t = max(0.0, 1.0 - d * 1.2)
            px[x, y] = (
                int(NAVY[0] + (NAVY_HI[0] - NAVY[0]) * t),
                int(NAVY[1] + (NAVY_HI[1] - NAVY[1]) * t),
                int(NAVY[2] + (NAVY_HI[2] - NAVY[2]) * t),
            )
    return bg


def rounded_alpha(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0]-1, img.size[1]-1], radius=radius, fill=255)
    out = img.copy().convert("RGBA")
    out.putalpha(mask)
    return out


def draw_card(d, x, y, cw, ch, radius, fill, border, alpha_layer):
    """Draw a rounded card on an RGBA composite layer."""
    tmp = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    td  = ImageDraw.Draw(tmp)
    td.rounded_rectangle([0, 0, cw-1, ch-1], radius=radius, fill=fill, outline=border, width=2)
    alpha_layer.alpha_composite(tmp, (x, y))


def pill(d, layer, x, y, label, fnt, bg, fg, pad_x, pad_y):
    tw = int(d.textlength(label, font=fnt))
    asc, desc = fnt.getmetrics()
    th = asc + desc
    pw, ph = tw + pad_x * 2, th + pad_y * 2
    tmp = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    td  = ImageDraw.Draw(tmp)
    td.rounded_rectangle([0, 0, pw-1, ph-1], radius=ph//2, fill=bg)
    td.text((pad_x, pad_y), label, font=fnt, fill=fg)
    layer.alpha_composite(tmp, (x, y))
    return pw


def main():
    base  = radial_bg((w, h)).convert("RGBA")
    d     = ImageDraw.Draw(base)

    S = SCALE
    PAD = 70 * S

    # ── Left panel: branding ──────────────────────────────────────────────────
    icon_sz = 148 * S
    icon    = Image.open(ICON).convert("RGBA").resize((icon_sz, icon_sz), Image.LANCZOS)
    icon    = rounded_alpha(icon, 32 * S)
    ix, iy  = PAD, (h - icon_sz) // 2
    base.alpha_composite(icon, (ix, iy))

    tx = ix + icon_sz + 32 * S

    # "MergeChain"
    name_f = font(56 * S, bold=True)
    ny     = iy + 8 * S
    d.text((tx, ny), "Merge", font=name_f, fill=WHITE)
    mw = int(d.textlength("Merge", font=name_f))
    d.text((tx + mw, ny), "Chain", font=name_f, fill=PURPLE)

    # Tagline
    tag_f = font(20 * S)
    ty    = ny + 68 * S
    d.text((tx, ty),          "GitLab-style merge dependencies", font=tag_f, fill=GRAY)
    d.text((tx, ty + 28 * S), "for GitHub pull requests",        font=tag_f, fill=GRAY)

    # Pill
    pill_f = font(14 * S, bold=True)
    py     = ty + 76 * S
    pill(d, base, tx, py, "Block the merge until deps land",
         pill_f, TEAL, TEAL_DARK, 13 * S, 6 * S)

    # Subtle vertical divider
    divx = tx + 420 * S
    for dy in range(PAD, h - PAD):
        base.putpixel((divx, dy), (38, 50, 90, 60))

    # ── Right panel: PR dependency cards ─────────────────────────────────────
    rx     = divx + 60 * S
    cw     = (w - rx - PAD)
    ch     = 150 * S
    cr     = 14 * S
    gap    = 36 * S
    cy_top = (h - (ch * 2 + gap)) // 2

    # ── Card A: merged / ready (green border) ────────────────────────────────
    card_a = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ca_d   = ImageDraw.Draw(card_a)
    ca_d.rounded_rectangle([0, 0, cw-1, ch-1], radius=cr, fill=NAVY_CARD, outline=CARD_BDR, width=2)
    # Green accent bar on left edge
    ca_d.rounded_rectangle([0, 0, 6*S, ch-1], radius=cr//2, fill=DOT_GREEN)

    # Status dot + label
    dot_r = 7 * S
    ca_d.ellipse([22*S - dot_r, ch//2 - dot_r, 22*S + dot_r, ch//2 + dot_r], fill=DOT_GREEN)
    stat_f = font(13 * S, bold=True)
    ca_d.text((36*S, ch//2 - 10*S), "MERGED", font=stat_f, fill=DOT_GREEN)
    sw = int(ca_d.textlength("MERGED", font=stat_f))

    # PR title
    title_f = font(18 * S, bold=True)
    ca_d.text((36*S, ch//2 - 38*S), "feat: add authentication layer", font=title_f, fill=WHITE)
    # PR meta
    meta_f = font(14 * S)
    ca_d.text((36*S, ch//2 + 14*S), "myorg/backend · PR #42", font=meta_f, fill=GRAY)

    base.alpha_composite(card_a, (rx, cy_top))

    # ── Arrow between cards ───────────────────────────────────────────────────
    ax   = rx + cw // 2
    ay1  = cy_top + ch + 6 * S
    ay2  = cy_top + ch + gap - 6 * S
    aym  = (ay1 + ay2) // 2
    for seg in range(ay1, ay2, 2):
        base.putpixel((ax, seg), (*TEAL_DIM, 200))
    # Arrowhead
    tip = ay2
    for spread in range(10 * S):
        x0 = ax - spread
        x1 = ax + spread
        y0 = tip - spread
        if 0 <= x0 < w and 0 <= y0 < h:
            base.putpixel((x0, y0), (*TEAL_DIM, max(0, 200 - spread * 12)))
        if 0 <= x1 < w and 0 <= y0 < h:
            base.putpixel((x1, y0), (*TEAL_DIM, max(0, 200 - spread * 12)))

    # "depends on" label next to arrow
    dep_f = font(12 * S)
    d.text((ax + 14 * S, aym - 9 * S), "depends on", font=dep_f, fill=GRAY_DIM)

    # ── Card B: blocked (red border) ─────────────────────────────────────────
    cy_bot = cy_top + ch + gap
    card_b = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    cb_d   = ImageDraw.Draw(card_b)
    cb_d.rounded_rectangle([0, 0, cw-1, ch-1], radius=cr, fill=NAVY_CARD, outline=CARD_BDR2, width=2)
    # Red accent bar
    cb_d.rounded_rectangle([0, 0, 6*S, ch-1], radius=cr//2, fill=DOT_RED)

    dot_r2 = 7 * S
    cb_d.ellipse([22*S - dot_r2, ch//2 - dot_r2, 22*S + dot_r2, ch//2 + dot_r2], fill=DOT_RED)
    cb_d.text((36*S, ch//2 - 10*S), "BLOCKED", font=stat_f, fill=DOT_RED)

    cb_d.text((36*S, ch//2 - 38*S), "feat: integrate payment flow", font=title_f, fill=WHITE)
    cb_d.text((36*S, ch//2 + 14*S), "myorg/backend · PR #91  ·  waiting for PR #42", font=meta_f, fill=GRAY)

    base.alpha_composite(card_b, (rx, cy_bot))

    # ── Teifi badge (bottom-right) ────────────────────────────────────────────
    badge_f = font(12 * S)
    badge   = "by Teifi"
    bw      = int(d.textlength(badge, font=badge_f))
    bx      = w - PAD - bw
    by      = h - 28 * S
    d.text((bx, by), badge, font=badge_f, fill=GRAY_DIM)

    final = base.convert("RGB").resize((W, H), Image.LANCZOS)
    final.save(OUT, quality=95)
    print("wrote", OUT, final.size)


if __name__ == "__main__":
    main()
