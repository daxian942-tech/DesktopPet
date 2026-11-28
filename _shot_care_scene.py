"""照顾场景验收拼图：2D / 3D × 猫 / 其他动物 × 喂食 / 喝水 / 玩耍 / 洗澡。

用法：
    python _shot_care_scene.py --quick    # 只拍 4 张关键帧（猫+柴犬 × 吃/洗）
    python _shot_care_scene.py            # 全量 4 物种 × 4 场景 × 2 引擎
输出：
    交付产物/照顾场景-2D验收.png
    交付产物/照顾场景-3D验收.png
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess
import sys

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
quick = "--quick" in sys.argv
try:
    FONT = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 18)
    FONT_SM = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 15)
except Exception:
    FONT = ImageFont.load_default()
    FONT_SM = FONT
out = root / "_care_scene"
out.mkdir(exist_ok=True)
chrome = r"C:/Program Files/Google/Chrome/Application/chrome.exe"

MOODS = ["eat", "drink", "play", "bath"]
MOOD_CN = {"eat": "喂食·碗", "drink": "喝水·水碗", "play": "玩耍·球", "bath": "洗澡·水"}
SUBJECTS = ["black", "shiba", "milkdragon", "capybara"]
SUBJECT_CN = {"black": "小黑猫", "shiba": "柴犬", "milkdragon": "奶龙", "capybara": "水豚噜噜"}

if quick:
    MOODS = ["eat", "bath"]
    SUBJECTS = ["black", "shiba"]

studio = (root / "tools/animal-studio.html").as_uri()
preview = (root / "tools/model-preview.html").as_uri()


def shot(url, dest, gl=False):
    cmd = [
        chrome, "--headless=new", "--disable-gpu-sandbox",
        "--window-size=720,720",
        "--screenshot=" + str(dest),
        "--virtual-time-budget=6000",
    ]
    if gl:
        cmd += ["--use-gl=angle", "--enable-unsafe-swiftshader", "--allow-file-access-from-files"]
    cmd.append(url)
    subprocess.run(cmd, check=True, capture_output=True)


def sheet(engine, paths, thumb, label_h):
    cols = len(MOODS)
    rows = len(SUBJECTS)
    w = thumb * cols
    h = (thumb + label_h) * rows + 40
    im = Image.new("RGB", (w, h), "#20242b")
    d = ImageDraw.Draw(im)
    d.text((12, 8), f"DesktopPet 照顾场景验收 - {engine}", fill="#ffffff", font=FONT)
    for r, subject in enumerate(SUBJECTS):
        for c, mood in enumerate(MOODS):
            p = paths[(subject, mood)]
            src = Image.open(p).convert("RGBA")
            bg = Image.new("RGBA", src.size, "#f4f1eb" if engine == "2D" else "#e9e5de")
            bg.alpha_composite(src)
            bg = bg.convert("RGB")
            bg.thumbnail((thumb, thumb))
            x = c * thumb
            y = 40 + r * (thumb + label_h)
            im.paste(bg, (x + (thumb - bg.width) // 2, y + (thumb - bg.height) // 2))
            d.text((x + 10, y + thumb + 6), f"{SUBJECT_CN[subject]} · {MOOD_CN[mood]}", fill="#e8e8e8", font=FONT_SM)
    return im


for engine in ["2D", "3D"]:
    paths = {}
    for subject in SUBJECTS:
        for mood in MOODS:
            dest = out / f"{engine.lower()}_{subject}_{mood}.png"
            if engine == "2D":
                url = f"{studio}?shot={subject}&t=2&mood={mood}"
            else:
                url = f"{preview}?pet={subject}&t=2&mood={mood}"
            print(f"[{engine}] {subject} / {mood} -> {dest.name}")
            shot(url, dest, gl=(engine == "3D"))
            paths[(subject, mood)] = dest
    target = root / f"交付产物/照顾场景-{engine}验收.png"
    sheet(engine, paths, 320, 32).save(target)
    print("saved:", target)

# 真实 2D 引擎（原版黑猫轮廓 + 键盘）：验证 catEngine 猫分支的道具位置
engine2d = (root / "tools/care-2d.html").as_uri()
real = {}
for mood in MOODS:
    dest = out / f"engine2d_{mood}.png"
    print(f"[2D-engine] {mood} -> {dest.name}")
    shot(f"{engine2d}?mood={mood}&t=2", dest)
    real[mood] = dest

thumb = 320
label_h = 32
im = Image.new("RGB", (thumb * 2, (thumb + label_h) * 2 + 40), "#20242b")
d = ImageDraw.Draw(im)
d.text((12, 8), "DesktopPet 2D 真实引擎 · 原版黑猫照顾场景", fill="#ffffff", font=FONT)
for i, mood in enumerate(MOODS):
    src = Image.open(real[mood]).convert("RGBA")
    bg = Image.new("RGBA", src.size, "#f4f1eb")
    bg.alpha_composite(src)
    bg = bg.convert("RGB")
    bg.thumbnail((thumb, thumb))
    x = (i % 2) * thumb
    y = 40 + (i // 2) * (thumb + label_h)
    im.paste(bg, (x + (thumb - bg.width) // 2, y + (thumb - bg.height) // 2))
    d.text((x + 10, y + thumb + 6), MOOD_CN[mood], fill="#e8e8e8", font=FONT_SM)
target = root / "交付产物/照顾场景-2D真实引擎验收.png"
im.save(target)
print("saved:", target)
