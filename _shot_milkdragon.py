"""奶龙造型验收截图：待机 / 打字两态，支持 before/after 标签与对照拼图。

用法：
  python _shot_milkdragon.py before    # 改前基线
  python _shot_milkdragon.py after     # 改后
  python _shot_milkdragon.py compare   # 拼「参考图 / 改前 / 改后待机 / 改后打字」四列
"""
from pathlib import Path
from PIL import Image, ImageDraw
import subprocess
import sys

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
out = root / "_milk_ref"
out.mkdir(exist_ok=True)
chrome = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
base = (root / "tools/model-preview.html").as_uri()
ref = Path(r"C:/Users/23248/.workbuddy/clipboard-images/clipboard-2026-11-28T05-58-32-680Z-fc66d906.jpg")

cmd = sys.argv[1] if len(sys.argv) > 1 else "before"


def shot(tag, query, name):
    subprocess.run([
        chrome, "--headless=new", "--disable-gpu-sandbox",
        "--use-gl=angle", "--enable-unsafe-swiftshader", "--allow-file-access-from-files",
        "--window-size=720,720",
        "--screenshot=" + str(out / f"{tag}_{name}.png"),
        "--virtual-time-budget=4500",
        base + "?" + query,
    ], check=True, capture_output=True)


if cmd in ("before", "after"):
    shot(cmd, "pet=milkdragon&t=2&reach=0", "idle")
    shot(cmd, "pet=milkdragon&t=2&reach=1&typing=left", "typing")
    print(f"saved {cmd}_idle.png / {cmd}_typing.png")
elif cmd == "compare":
    items = [
        ("USER REFERENCE", ref),
        ("BEFORE (idle)", out / "before_idle.png"),
        ("AFTER (idle)", out / "after_idle.png"),
        ("AFTER (typing)", out / "after_typing.png"),
    ]
    thumb, label_h = 400, 40
    sheet = Image.new("RGB", (thumb * 4, 520 + label_h), "#20242b")
    draw = ImageDraw.Draw(sheet)
    for i, (label, path) in enumerate(items):
        im = Image.open(path).convert("RGBA")
        bg = Image.new("RGBA", im.size, "#e9e5de")
        bg.alpha_composite(im)
        bg = bg.convert("RGB")
        bg.thumbnail((thumb, 520))
        x = i * thumb
        sheet.paste(bg, (x + (thumb - bg.width) // 2, (520 - bg.height) // 2))
        draw.text((x + 12, 520 + 12), label, fill="#ffffff")
    target = root / "交付产物/奶龙-参考图对照.png"
    sheet.save(target)
    print(target)
else:
    raise SystemExit(f"unknown cmd: {cmd}")
