#!/usr/bin/env python3
"""Regenerate the Android launcher icons and the PWA home-screen icons.

    python scripts/gen-icons.py

Everything is derived from src/assets/carapils.png, always by scaling DOWN
(the can is 231x427 there), so the output stays sharp.

Two things that are easy to get wrong and were both bugs here once:

* Adaptive icon layers are 108dp, not the 48dp of a legacy icon. At xxxhdpi
  that is 432x432, not 192x192. Authoring them at legacy sizes makes Android
  upscale every layer and the icon looks soft.
* An adaptive icon already reserves the outer 18dp of its canvas for masking,
  so ic_launcher.xml must NOT add another inset on top. Doing so shrinks the
  artwork a second time.

The circular mask crops to the centre 72dp. CAN_FILL is expressed as a
fraction of that visible area, so 0.95 means the can nearly fills the circle
while still fitting inside it.
"""
from PIL import Image, ImageDraw, ImageFilter
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android/app/src/main/res')
SOURCE = os.path.join(ROOT, 'src/assets/carapils.png')

BG = (250, 245, 233)          # matches the app background (#faf5e9)
CAN_FILL = 0.95               # of the visible (masked) area, for adaptive layers
LEGACY_FILL = 0.78            # legacy icons are drawn as-is, so they can run bigger
ROUND_FILL = 0.70

ADAPTIVE = {'ldpi': 81, 'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
LEGACY = {'ldpi': 36, 'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
PWA = (72, 96, 128, 144, 152, 192, 384, 512)

can = Image.open(SOURCE).convert('RGBA')
can = can.crop(can.getbbox())


def render(canvas_px, can_h, bg=None, circle=False):
    img = Image.new('RGBA', (canvas_px, canvas_px), (0, 0, 0, 0))
    if bg:
        if circle:
            ImageDraw.Draw(img).ellipse([0, 0, canvas_px - 1, canvas_px - 1], fill=bg + (255,))
        else:
            img.paste(bg + (255,), [0, 0, canvas_px, canvas_px])

    h = max(1, int(can_h))
    w = max(1, round(can.width * h / can.height))
    c = can.resize((w, h), Image.LANCZOS)
    if canvas_px >= 96:
        # Recovers the micro-contrast that any downscale costs. Skipped at tiny
        # sizes, where it just produces crunchy edges.
        c = c.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=2))

    x, y = (canvas_px - w) // 2, (canvas_px - h) // 2
    if canvas_px >= 96:
        # Tight shadow only. A wide blur reads as the icon being out of focus.
        shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 80), (x, y + 2), c)
        img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(max(1, canvas_px / 200))))
    img.alpha_composite(c, (x, y))
    return img


for density, px in ADAPTIVE.items():
    out = os.path.join(RES, 'mipmap-' + density)
    visible = px * 72 / 108
    render(px, visible * CAN_FILL).save(os.path.join(out, 'ic_launcher_foreground.png'))
    Image.new('RGBA', (px, px), BG + (255,)).save(os.path.join(out, 'ic_launcher_background.png'))

for density, px in LEGACY.items():
    out = os.path.join(RES, 'mipmap-' + density)
    render(px, px * LEGACY_FILL, bg=BG).save(os.path.join(out, 'ic_launcher.png'))
    render(px, px * ROUND_FILL, bg=BG, circle=True).save(os.path.join(out, 'ic_launcher_round.png'))

for px in PWA:
    render(px, px * LEGACY_FILL, bg=BG).convert('RGB').save(
        os.path.join(ROOT, 'public/icons/icon-%dx%d.png' % (px, px)))

print('icons regenerated from', os.path.relpath(SOURCE, ROOT))
