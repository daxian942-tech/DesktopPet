"""60 秒抖音竖屏功能介绍视频合成（1080x1920 / 30fps）。

画面全部基于真实 KuroCatEngine 截帧（跳跃三态、喝水水碗、洗澡泡泡），
用 PIL 逐帧排版成暖纸风竖屏，再用 ffmpeg  pipe 编码 H.264 + AAC。
"""
from pathlib import Path
import json, math, subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
ASSETS = ROOT / "_video_assets"
AUDIO = ROOT / "_video_audio"
OUT = ROOT / "交付产物" / "DesktopPet-猫咪新功能-抖音60秒.mp4"
FFMPEG = r"C:/Users/23248/.workbuddy/binaries/ffmpeg-full/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe"

W, H, FPS = 1080, 1920, 30
TOTAL = 60.0
N = int(TOTAL * FPS)

# 品牌配色（沿用 remotion/src/theme.ts）
PAPER = (251, 247, 239)
PAPER2 = (243, 237, 225)
INK = (42, 37, 33)
INK_SOFT = (107, 98, 89)
ACCENT = (229, 111, 79)
SAGE = (111, 146, 126)
CARD = (255, 253, 248)
LINE = (227, 217, 200)
BLUE = (86, 164, 214)


def F(size, bold=False):
    names = ["C:/Windows/Fonts/msyhbd.ttc", "C:/Windows/Fonts/msyh.ttc"] if bold \
        else ["C:/Windows/Fonts/msyh.ttc"]
    for p in names:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def a_img(name):
    return Image.open(ASSETS / f"{name}.png").convert("RGBA")


ASSET = {k: a_img(k) for k in [
    "idle_2d", "charge_2d", "air_2d", "land_2d",
    "eat_2d", "drink_2d", "play_2d", "bath_2d",
    "idle_3d", "air_3d", "pets_grid",
]}

TIMING = json.loads((AUDIO / "timing.json").read_text(encoding="utf-8"))
SEGS = TIMING["segments"]

# 镜头边界：每段旁白对应一个镜头，最后补片尾
STARTS = [0.0] + [SEGS[i]["start"] - 0.18 for i in range(1, len(SEGS))] + [SEGS[-1]["end"]]
ENDS = STARTS[1:] + [TOTAL]

TITLES = [
    ("桌面上的猫", "更新了"),
    ("按住往下拖", "蓄力"),
    ("松手 · 起跳", "蹦！"),
    ("点一下", "四个按钮"),
    ("喝水", "专属水碗"),
    ("洗澡", "水滴与泡泡"),
    ("不止是猫", "全家都更新"),
    ("DesktopPet", "免费开源"),
]
TAGS = [
    "DESKTOPPET · 猫咪新功能",
    "① 跳跃 · 蓄力",
    "② 跳跃 · 腾空",
    "③ 照顾 · 快捷栏",
    "④ 照顾 · 喝水",
    "⑤ 照顾 · 洗澡",
    "12 只动物 · 2D / 3D",
    "链接在评论区",
]

# ---------- 预渲染静态层 ----------
def make_bg():
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    for y in range(H):
        k = y / H
        c = tuple(int(PAPER[i] * (1 - k * 0.55) + PAPER2[i] * k * 0.55) for i in range(3))
        d.line([(0, y), (W, y)], fill=c)
    d.rectangle([0, 0, W, 10], fill=ACCENT)
    # 右下角淡淡圆点装饰
    d.ellipse([W - 230, H - 430, W + 40, H - 160], fill=(246, 238, 226))
    return im

BG = make_bg()


def text_layer(size, color, lines, spacing=1.28, bold=False, align="center"):
    """把多行文字渲染成透明 RGBA 图，返回 (图, 宽, 高)。"""
    f = F(size, bold)
    widths, heights = [], []
    for ln in lines:
        b = f.getbbox(ln)
        widths.append(b[2] - b[0])
        heights.append(int(size * spacing))
    w = max(widths) + 20
    h = sum(heights) + 16
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    y = 8
    for i, ln in enumerate(lines):
        x = (w - widths[i]) // 2 if align == "center" else 10
        d.text((x, y), ln, font=f, fill=color)
        y += heights[i]
    return im, w, h


TITLE_IMGS = []
for a, b in TITLES:
    la = text_layer(84 if len(a) <= 6 else 72, INK, [a], bold=True)[0]
    lb = text_layer(84 if len(b) <= 6 else 72, ACCENT, [b], bold=True)[0]
    TITLE_IMGS.append((la, lb))
TAG_IMGS = [text_layer(34, INK_SOFT, [t], bold=True)[0] for t in TAGS]

SUB_IMGS = []
for s in SEGS:
    clean = "".join(ch for ch in s["text"] if ch not in "，。：、,.!?！？；")
    per = 13
    lines = [clean[i:i + per] for i in range(0, len(clean), per)]
    size = 46 if len(lines) <= 3 else 40
    im, w, h = text_layer(size, INK, lines, spacing=1.52, bold=True)
    SUB_IMGS.append((im, w, h))


def paste_center(base, im, cx, cy, alpha=1.0):
    x, y = int(cx - im.width / 2), int(cy - im.height / 2)
    if alpha >= 0.999:
        base.paste(im, (x, y), im)
    else:
        a = im.getchannel("A").point(lambda v: int(v * alpha))
        tmp = im.copy()
        tmp.putalpha(a)
        base.paste(tmp, (x, y), tmp)


def asset_scaled(name, scale, cache={}):
    # 量化到 0.01 并限制缓存条目，避免 1800 帧生成上千张 1000x1000 RGBA 撑爆内存
    s = max(0.05, round(scale * 100) / 100)
    key = (name, s)
    if key not in cache:
        if len(cache) > 80:
            cache.clear()
        im = ASSET[name]
        cache[key] = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    return cache[key]


def draw_card(d, box, radius, fill, outline=None, width=2):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def bubble(d, cx, cy, r, color, alpha):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (int(alpha),))


def render(t, frame_no):
    im = BG.copy()
    d = ImageDraw.Draw(im, "RGBA")

    # 找当前镜头
    idx = 0
    for i in range(len(STARTS)):
        if t >= STARTS[i]:
            idx = i
    st, en = STARTS[idx], ENDS[idx]
    local = t - st
    dur = max(0.01, en - st)
    u = max(0.0, min(1.0, local / dur))

    # 顶部固定眉标
    d.text((60, 62), "DesktopPet · 桌面宠物", font=F(32, True), fill=INK_SOFT + (220,))
    d.text((W - 60, 62), "60s", font=F(30, True), fill=INK_SOFT + (180,))

    # 标题（大字两行，第二行橙色）
    la, lb = TITLE_IMGS[idx]
    paste_center(im, la, W / 2, 190, ease(local / 0.35))
    paste_center(im, lb, W / 2, 288, ease((local - 0.08) / 0.35))
    paste_center(im, TAG_IMGS[idx], W / 2, 372, ease((local - 0.15) / 0.3))

    # 主视觉区
    VIS_Y = 430
    VIS_H = 940
    cx = W / 2

    if idx == 0:  # 开场：待机猫，缓慢推近 + 呼吸
        sc = 0.92 + 0.035 * u
        a = asset_scaled("idle_2d", sc)
        yy = VIS_Y + math.sin(t * 2.1) * 6
        paste_center(im, a, cx, yy + VIS_H / 2, ease(local / 0.4))

    elif idx == 1:  # 蓄力：压扁素材 + 向下箭头 + 蓄力进度条
        sc = 0.94 + 0.01 * math.sin(t * 8)
        a = asset_scaled("charge_2d", sc)
        paste_center(im, a, cx, VIS_Y + VIS_H / 2 + 10, ease(local / 0.3))
        # 向下手势箭头
        ax, ay = 150, 760 + 40 * math.sin(t * 4)
        d.line([(ax, ay - 90), (ax, ay + 40)], fill=ACCENT + (235,), width=14)
        d.polygon([(ax - 26, ay + 18), (ax + 26, ay + 18), (ax, ay + 66)], fill=ACCENT + (235,))
        d.text((ax - 82, ay + 90), "按住往下拖", font=F(30, True), fill=ACCENT + (235,))
        # 蓄力条
        bx0, bx1, by = 300, 780, 1330
        draw_card(d, [bx0, by, bx1, by + 26], 13, CARD + (235,), LINE + (255,), 2)
        pw = int((bx1 - bx0 - 8) * ease(u))
        if pw > 4:
            draw_card(d, [bx0 + 4, by + 4, bx0 + 4 + pw, by + 22], 9, ACCENT + (235,))
        d.text((bx0, by - 46), "蓄 力 中", font=F(30, True), fill=INK_SOFT + (230,))

    elif idx == 2:  # 起跳：真实三态循环两轮
        # 两轮跳跃，相位偏移让每段中段都落在腾空态；空中占 66%，
        # 落地后直接回到蓄力准备下一次，不插入容易看成静止的待机帧。
        cyc = (u * 2.0 + 0.5) % 1.0
        if cyc < 0.12:
            name = "charge_2d"
        elif cyc < 0.78:
            name = "air_2d"
        elif cyc < 0.90:
            name = "land_2d"
        else:
            name = "charge_2d"
        sc = 0.93 + 0.02 * math.sin(t * 3)
        a = asset_scaled(name, sc)
        paste_center(im, a, cx, VIS_Y + VIS_H / 2, ease(local / 0.25))
        d.text((W - 250, 500), "键盘留在桌面", font=F(30, True), fill=SAGE + (235,))

    elif idx == 3:  # 头顶四个按钮 + 喂食碗
        a = asset_scaled("eat_2d", 0.93 + 0.02 * u)
        paste_center(im, a, cx, VIS_Y + VIS_H / 2 + 20, ease(local / 0.3))
        labels = ["喂食", "喝水", "玩耍", "洗澡"]
        bw, bh, gap = 178, 78, 16
        total_w = bw * 4 + gap * 3
        x0 = (W - total_w) // 2
        for i, lab in enumerate(labels):
            x = x0 + i * (bw + gap)
            pop = ease((local - 0.12 - i * 0.07) / 0.28)
            yy = 402 - 16 * pop
            draw_card(d, [x, yy, x + bw, yy + bh], 26, CARD + (int(245 * pop),), ACCENT + (int(220 * pop),), 3)
            d.text((x + bw / 2 - 46, yy + 18), lab, font=F(38, True), fill=INK + (int(255 * pop),))

    elif idx in (4, 5):  # 喝水 / 洗澡 + 上浮泡泡
        name = "drink_2d" if idx == 4 else "bath_2d"
        a = asset_scaled(name, 0.93 + 0.025 * u)
        paste_center(im, a, cx, VIS_Y + VIS_H / 2 + 14, ease(local / 0.3))
        col = BLUE if idx == 4 else (255, 255, 255)
        for k in range(7):
            ph = (t * 0.55 + k * 0.31) % 1.0
            bx = 250 + (k * 137) % 560
            by = 1230 - ph * 560
            r = 12 + (k % 3) * 7
            bubble(d, bx, by, r, col, int(150 * (1 - ph) * ease(local / 0.4)))

    elif idx == 6:  # 全家福 + 3D 角标
        a = asset_scaled("pets_grid", 0.9 + 0.03 * u)
        paste_center(im, a, cx, VIS_Y + VIS_H / 2 - 30, ease(local / 0.35))
        mini = asset_scaled("idle_3d", 0.26)
        paste_center(im, mini, 840, 460, ease((local - 0.5) / 0.4))
        d.text((690, 570), "2D / 3D", font=F(32, True), fill=SAGE + (235,))

    else:  # 片尾
        a = asset_scaled("idle_2d", 0.78)
        paste_center(im, a, cx, VIS_Y + VIS_H / 2 - 60, 1.0)
        draw_card(d, [150, 1180, 930, 1330], 30, CARD + (245,), LINE + (255,), 3)
        d.text((W / 2 - 168, 1210), "免费开源 · 养一只在桌面", font=F(38, True), fill=INK + (255,))
        d.text((W / 2 - 130, 1270), "链接在评论区", font=F(36, True), fill=ACCENT + (255,))

    # ---------- 底部字幕 ----------
    sub_idx = None
    for i, s in enumerate(SEGS):
        if s["start"] - 0.1 <= t <= s["end"] + 0.25:
            sub_idx = i
            break
    if sub_idx is not None:
        sim, sw, sh = SUB_IMGS[sub_idx]
        card_w = min(W - 100, sw + 70)
        card_h = sh + 46
        cy = 1520
        box = [(W - card_w) // 2, cy - card_h // 2, (W + card_w) // 2, cy + card_h // 2]
        draw_card(d, box, 24, CARD + (242,), LINE + (255,), 2)
        paste_center(im, sim, W / 2, cy, ease((t - SEGS[sub_idx]["start"] + 0.1) / 0.22))

    # 进度条
    d.rectangle([60, 1846, W - 60, 1852], fill=LINE + (255,))
    d.rectangle([60, 1846, 60 + int((W - 120) * (t / TOTAL)), 1852], fill=ACCENT + (255,))

    # 镜头开头从背景淡入
    fade = ease(local / 0.32)
    if fade < 0.999:
        im = Image.blend(BG, im, fade)
    return im


def main():
    cmd = [FFMPEG, "-y", "-v", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", str(AUDIO / "soundtrack.wav"),
           "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
           "-shortest", "-movflags", "+faststart", str(OUT)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in range(N):
        t = n / FPS
        frame = render(t, n).convert("RGB")
        proc.stdin.write(frame.tobytes())
        if n % 300 == 0:
            print(f"  frame {n}/{N}  t={t:.1f}s")
    proc.stdin.close()
    rc = proc.wait()
    if rc != 0:
        raise RuntimeError(f"ffmpeg failed: {rc}")
    print("saved:", OUT, OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
