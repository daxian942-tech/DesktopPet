"""生成抖音 3:4 竖版封面（1080x1440），风格与 60 秒成片一致。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
OUT = ROOT / "交付产物" / "DesktopPet-猫咪新功能-抖音封面.jpg"
W, H = 1080, 1440

PAPER = (251, 247, 239)
PAPER2 = (243, 237, 225)
INK = (42, 37, 33)
ACCENT = (229, 111, 79)
SAGE = (111, 146, 126)
CARD = (255, 253, 248)
LINE = (227, 217, 200)


def F(size, bold=False):
    for p in (["C:/Windows/Fonts/msyhbd.ttc", "C:/Windows/Fonts/msyh.ttc"]
              if bold else ["C:/Windows/Fonts/msyh.ttc"]):
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()


im = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(im, "RGBA")
for y in range(H):
    k = y / H
    c = tuple(int(PAPER[i] * (1 - k * 0.6) + PAPER2[i] * k * 0.6) for i in range(3))
    d.line([(0, y), (W, y)], fill=c)
d.rectangle([0, 0, W, 12], fill=ACCENT)

d.text((60, 60), "DesktopPet · 桌面宠物", font=F(32, True), fill=(107, 98, 89, 230))
d.text((W // 2 - 260, 130), "猫咪新功能", font=F(100, True), fill=INK + (255,))
d.text((W // 2 - 300, 265), "会跳了 · 会喝水 · 会洗澡", font=F(50, True), fill=ACCENT + (255,))

# 腾空黑猫（真实引擎截图）
a = Image.open(ROOT / "_video_assets/air_2d.png").convert("RGBA")
a = a.resize((int(a.width * 0.72), int(a.height * 0.72)), Image.LANCZOS)
im.paste(a, ((W - a.width) // 2, 330), a)

# 三个功能标签
labels = [("跳", "按住蓄力"), ("喝水", "专属水碗"), ("洗澡", "水滴泡泡")]
bw, bh, gap = 292, 130, 26
x0 = (W - (bw * 3 + gap * 2)) // 2
for i, (a1, a2) in enumerate(labels):
    x = x0 + i * (bw + gap)
    d.rounded_rectangle([x, 1090, x + bw, 1090 + bh], radius=26,
                        fill=CARD + (250,), outline=LINE + (255,), width=3)
    d.text((x + bw // 2 - 34, 1108), a1, font=F(50, True), fill=ACCENT + (255,))
    d.text((x + bw // 2 - 70, 1172), a2, font=F(30, True), fill=INK + (235,))

d.text((W // 2 - 250, 1285), "12 只动物 · 2D / 3D · 免费开源", font=F(38, True), fill=SAGE + (255,))
d.text((W // 2 - 120, 1350), "链接在评论区", font=F(32, True), fill=(107, 98, 89, 230))

im.convert("RGB").save(OUT, quality=92, subsampling=0)
print("saved:", OUT, OUT.stat().st_size, "bytes")
