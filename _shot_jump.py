"""跳跃功能验收拼图：2D 真实引擎 / 3D × 猫与 3 只动物 × 蓄力 / 空中 / 落地三态。

用法：
    python _shot_jump.py
输出：
    交付产物/跳跃-2D验收.png
    交付产物/跳跃-3D验收.png
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
try:
    FONT = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 18)
    FONT_SM = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 15)
except Exception:
    FONT = ImageFont.load_default()
    FONT_SM = FONT

out = root / "_jump_shots"
out.mkdir(exist_ok=True)
chrome = r"C:/Program Files/Google/Chrome/Application/chrome.exe"

PHASES = ["charge", "air", "land"]
PHASE_CN = {"charge": "蓄力·下蹲", "air": "起跳·空中", "land": "落地·回弹"}
SUBJECTS = ["black", "shiba", "milkdragon", "capybara"]
SUBJECT_CN = {"black": "小黑猫", "shiba": "柴犬", "milkdragon": "奶龙", "capybara": "水豚噜噜"}

engine2d = (root / "tools/care-2d.html").as_uri()
preview3d = (root / "tools/model-preview.html").as_uri()


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
    cols = len(PHASES)
    rows = len(SUBJECTS)
    w = thumb * cols
    h = (thumb + label_h) * rows + 40
    im = Image.new("RGB", (w, h), "#20242b")
    d = ImageDraw.Draw(im)
    d.text((12, 8), f"DesktopPet 跳跃验收 - {engine}（按住往下拖蓄力 / 松手起跳）", fill="#ffffff", font=FONT)
    for r, subject in enumerate(SUBJECTS):
        for c, phase in enumerate(PHASES):
            p = paths[(subject, phase)]
            src = Image.open(p).convert("RGBA")
            bg = Image.new("RGBA", src.size, "#f4f1eb" if engine == "2D" else "#e9e5de")
            bg.alpha_composite(src)
            bg = bg.convert("RGB")
            bg.thumbnail((thumb, thumb))
            x = c * thumb
            y = 40 + r * (thumb + label_h)
            im.paste(bg, (x + (thumb - bg.width) // 2, y + (thumb - bg.height) // 2))
            d.text((x + 10, y + thumb + 6), f"{SUBJECT_CN[subject]} · {PHASE_CN[phase]}", fill="#e8e8e8", font=FONT_SM)
    return im


for engine in ["2D", "3D"]:
    paths = {}
    for subject in SUBJECTS:
        for phase in PHASES:
            dest = out / f"{engine.lower()}_{subject}_{phase}.png"
            if engine == "2D":
                url = f"{engine2d}?pet={subject}&jump={phase}&jumpAmt=1"
            else:
                url = f"{preview3d}?pet={subject}&t=2&jump={phase}&jumpAmt=1"
            print(f"[{engine}] {subject} / {phase} -> {dest.name}")
            shot(url, dest, gl=(engine == "3D"))
            paths[(subject, phase)] = dest
    target = root / f"交付产物/跳跃-{engine}验收.png"
    sheet(engine, paths, 320, 32).save(target)
    print("saved:", target)
