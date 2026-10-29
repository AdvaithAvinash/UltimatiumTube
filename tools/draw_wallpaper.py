# Draws wallpapers/blue-flames.jpg:  python3 tools/draw_wallpaper.py wallpapers/blue-flames.jpg
# Blue flames rising from the bottom on black: vertically stretched, sideways-warped noise,
# cut into thin wisps, coloured deep blue to pale cyan, with a soft bloom.
import sys
import numpy as np
from PIL import Image, ImageFilter

W, H = 1920, 1080
rng = np.random.RandomState(11)

def noise(cx, cy):
    g = rng.rand(cy + 2, cx + 2)
    img = Image.fromarray((g * 255).astype('uint8')).resize((W, H), Image.BICUBIC)
    return np.asarray(img, dtype='float32') / 255.0

def fbm(cx, cy, octaves):
    total = np.zeros((H, W), dtype='float32'); amp = 1.0; norm = 0.0
    for o in range(octaves):
        total += amp * noise(cx * 2 ** o, max(2, int(cy * 2 ** o))); norm += amp; amp *= 0.55
    return total / norm

yy, xx = np.mgrid[0:H, 0:W].astype('float32')
up = yy / H                                   # 0 at the top, 1 at the bottom

# long vertical streaks, bent sideways more the higher they go
bend = (fbm(3, 2, 4) - 0.5) * 380.0 * (1.0 - up) ** 0.8
sway = (fbm(9, 3, 3) - 0.5) * 90.0
sx = np.clip(xx + bend + sway, 0, W - 1).astype(int)
sy = np.clip(yy + (fbm(4, 3, 3) - 0.5) * 160.0, 0, H - 1).astype(int)
streaks = fbm(26, 3, 5)[sy, sx]                # many columns, few rows: tall wisps

fil = np.zeros((H, W), dtype='float32')
for lvl, wid, gain in [(0.50, 0.050, 1.0), (0.42, 0.040, 0.7), (0.58, 0.040, 0.7), (0.35, 0.05, 0.4)]:
    fil += gain * np.exp(-((streaks - lvl) / wid) ** 2)

# how high the fire reaches at each column, ragged
reach = 0.28 + 0.62 * fbm(7, 2, 3)[sy, sx]
inside = np.clip((up - (1.0 - reach)) / 0.22, 0, 1)        # fades out at the tip
body = np.clip(fbm(14, 3, 3)[sy, sx] * 1.1, 0, 1) * inside * (0.25 + 0.75 * up ** 1.2)

val = np.clip(fil * inside * (0.35 + 0.9 * up) + body * 0.5, 0, 1.3)
val = 0.8 * val / (1 + 0.18 * val)

stops = np.array([0.0, 0.15, 0.40, 0.70, 1.0], dtype='float32')
cols = np.array([[0, 0, 0], [3, 10, 60], [14, 78, 220], [90, 180, 255], [225, 244, 255]], dtype='float32')
v = np.clip(val, 0, 1)
rgb = np.stack([np.interp(v, stops, cols[:, c]) for c in range(3)], axis=-1)

img = Image.fromarray(rgb.astype('uint8')).filter(ImageFilter.GaussianBlur(1.1))
bloom = img.filter(ImageFilter.GaussianBlur(16))
out = np.clip(np.asarray(img, dtype='float32') + 0.5 * np.asarray(bloom, dtype='float32'), 0, 255).astype('uint8')
Image.fromarray(out).save(sys.argv[1], quality=88, optimize=True, progressive=True)
print('written', sys.argv[1])
