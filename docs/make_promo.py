"""Compose the Chrome Web Store small promo tile (440x280) from the icon + text.
No browser, no SVG — pure Pillow so it renders reliably anywhere.
Run: /tmp/mcvenv/bin/python docs/make_promo.py
"""
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ICON = os.path.join(HERE, "..", "icons", "icon-512.png")
OUT = os.path.join(HERE, "promo-tile-small.png")

W, H = 440, 280
SCALE = 3  # supersample for crisp text, downscale at the end
w, h = W * SCALE, H * SCALE

NAVY = (10, 14, 26)
NAVY_HI = (27, 36, 68)
WHITE = (230, 237, 243)
PURPLE = (167, 139, 250)
GRAY = (154, 164, 178)
TEAL = (52, 211, 153)
TEAL_DARK = (6, 40, 30)

SF = "/System/Library/Fonts/SFNS.ttf"
HELV = "/System/Library/Fonts/Helvetica.ttc"


def font(size, bold=False):
    try:
        # SFNS is variable; Pillow picks a default weight. Use Helvetica bold ttc index for bold.
        if bold:
            return ImageFont.truetype(HELV, size, index=1)
        return ImageFont.truetype(HELV, size, index=0)
    except Exception:
        return ImageFont.load_default()


def radial_bg(size):
    """Dark navy with a soft highlight toward the top-right."""
    bw, bh = size
    bg = Image.new("RGB", size, NAVY)
    px = bg.load()
    cx, cy = bw * 0.82, bh * -0.1
    maxd = (bw ** 2 + bh ** 2) ** 0.5
    for y in range(bh):
        for x in range(0, bw, 1):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / maxd
            t = max(0.0, 1.0 - d * 1.35)
            px[x, y] = (
                int(NAVY[0] + (NAVY_HI[0] - NAVY[0]) * t),
                int(NAVY[1] + (NAVY_HI[1] - NAVY[1]) * t),
                int(NAVY[2] + (NAVY_HI[2] - NAVY[2]) * t),
            )
    return bg


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0], img.size[1]], radius=radius, fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


def main():
    base = radial_bg((w, h)).convert("RGBA")
    d = ImageDraw.Draw(base)

    # Icon, rounded, left side
    icon_sz = 124 * SCALE
    icon = Image.open(ICON).convert("RGBA").resize((icon_sz, icon_sz), Image.LANCZOS)
    icon = rounded(icon, 27 * SCALE)
    ix, iy = 38 * SCALE, (h - icon_sz) // 2
    base.alpha_composite(icon, (ix, iy))

    tx = ix + icon_sz + 26 * SCALE

    # Name: "Merge" white + "Chain" purple
    name_f = font(41 * SCALE, bold=True)
    ny = 70 * SCALE
    d.text((tx, ny), "Merge", font=name_f, fill=WHITE)
    mw = d.textlength("Merge", font=name_f)
    d.text((tx + mw, ny), "Chain", font=name_f, fill=PURPLE)

    # Tagline (two lines)
    tag_f = font(16 * SCALE, bold=False)
    ty = ny + 52 * SCALE
    d.text((tx, ty), "GitLab-style merge dependencies", font=tag_f, fill=GRAY)
    d.text((tx, ty + 23 * SCALE), "for GitHub pull requests", font=tag_f, fill=GRAY)

    # Pill: "Block the merge until deps land"
    pill_f = font(12 * SCALE, bold=True)
    label = "Block the merge until deps land"
    pad_x, pad_y = 11 * SCALE, 5 * SCALE
    tw = d.textlength(label, font=pill_f)
    asc, desc = pill_f.getmetrics()
    th = asc + desc
    py = ty + 56 * SCALE
    d.rounded_rectangle(
        [tx, py, tx + tw + pad_x * 2, py + th + pad_y * 2],
        radius=(th + pad_y * 2) // 2,
        fill=TEAL,
    )
    d.text((tx + pad_x, py + pad_y), label, font=pill_f, fill=TEAL_DARK)

    final = base.convert("RGB").resize((W, H), Image.LANCZOS)
    final.save(OUT)
    print("wrote", OUT, final.size)


if __name__ == "__main__":
    main()
