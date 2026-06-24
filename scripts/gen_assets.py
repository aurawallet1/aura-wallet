#!/usr/bin/env python3
"""Generate Aura Wallet brand assets (SplashIcon + AppIcon)."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "ios", "AuraWallet", "Images.xcassets")
ORANGE = (247, 147, 26, 255)   # #F7931A bitcoin orange
WHITE = (255, 255, 255, 255)

FONT_CANDIDATES = [
    "/System/Library/Fonts/SFNSRounded.ttf",
    "/System/Library/Fonts/SFNS.ttf",
    "/System/Library/Fonts/SFNSDisplay.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
]

def load_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

def draw_glyph(img, ch, color):
    d = ImageDraw.Draw(img)
    W, H = img.size
    font = load_font(int(H * 0.62))
    try:
        bbox = d.textbbox((0, 0), ch, font=font)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text(((W - w) / 2 - bbox[0], (H - h) / 2 - bbox[1]), ch, font=font, fill=color)
        # tofu / empty detection: if glyph is essentially empty, fall back to "B"
        if w < H * 0.1:
            raise ValueError("empty glyph")
    except Exception:
        d.text((0, 0), "", font=font)  # noop
        font2 = load_font(int(H * 0.6))
        bbox = d.textbbox((0, 0), "B", font=font2)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text(((W - w) / 2 - bbox[0], (H - h) / 2 - bbox[1]), "B", font=font2, fill=color)

def rounded_tile(size, radius_ratio=0.22, bg=ORANGE):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * radius_ratio)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=bg)
    return img

# ---- SplashIcon: rounded orange tile + white Bitcoin sign, transparent margin ----
splash = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
tile = rounded_tile(420)
glyph_layer = Image.new("RGBA", (420, 420), (0, 0, 0, 0))
draw_glyph(glyph_layer, "₿", WHITE)
tile.alpha_composite(glyph_layer)
splash.paste(tile, (46, 46), tile)
splash_dir = os.path.join(ASSETS, "SplashIcon.imageset")
os.makedirs(splash_dir, exist_ok=True)
splash.save(os.path.join(splash_dir, "SplashIcon.png"))

with open(os.path.join(splash_dir, "Contents.json"), "w") as f:
    f.write('''{
  "images" : [
    {
      "filename" : "SplashIcon.png",
      "idiom" : "universal"
    }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
''')

# ---- AppIcon: full-bleed orange (no alpha) + white Bitcoin sign, 1024 universal ----
appicon = Image.new("RGB", (1024, 1024), ORANGE[:3])
glyph_layer = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
draw_glyph(glyph_layer, "₿", WHITE)
appicon.paste(glyph_layer, (0, 0), glyph_layer)
appdir = os.path.join(ASSETS, "AppIcon.appiconset")
os.makedirs(appdir, exist_ok=True)
appicon.save(os.path.join(appdir, "AppIcon-1024.png"))

with open(os.path.join(appdir, "Contents.json"), "w") as f:
    f.write('''{
  "images" : [
    {
      "filename" : "AppIcon-1024.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
''')

print("Assets generated:")
print(" -", os.path.join(splash_dir, "SplashIcon.png"))
print(" -", os.path.join(appdir, "AppIcon-1024.png"))
