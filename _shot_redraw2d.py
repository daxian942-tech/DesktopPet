"""Headless 2D acceptance sheet. Uses system Chrome directly (no playwright).

默认：12 只待机收手态（reach=0）。
加 --typing：12 只打字伸手态（reach=1、typing=1）。
"""
from pathlib import Path
from PIL import Image, ImageDraw
import subprocess
import sys

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
typing = "--typing" in sys.argv
out = root / ("_redraw2d_typing" if typing else "_redraw2d")
out.mkdir(exist_ok=True)
keys = ["shiba", "fox", "panda", "bunny", "penguin", "frog", "chiikawa", "grasscow", "milkdragon", "capybara", "loopy", "bubu"]

chrome = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
base = (root / "tools/animal-studio.html").as_uri()
for key in keys:
    subprocess.run([
        chrome, "--headless=new", "--disable-gpu-sandbox",
        "--window-size=720,720",
        "--screenshot=" + str(out / f"{key}.png"),
        "--virtual-time-budget=3500",
        base + "?shot=" + key + ("&t=2&typing=1&reach=1" if typing else "&t=2"),
    ], check=True, capture_output=True)

thumb = 320
label_h = 34
sheet = Image.new("RGB", (thumb * 4, (thumb + label_h) * 3), "#20242b")
draw = ImageDraw.Draw(sheet)
for i, key in enumerate(keys):
    im = Image.open(out / f"{key}.png").convert("RGBA")
    bg = Image.new("RGBA", im.size, "#f4f1eb")
    bg.alpha_composite(im)
    bg = bg.convert("RGB")
    bg.thumbnail((thumb, thumb))
    x = (i % 4) * thumb
    y = (i // 4) * (thumb + label_h)
    sheet.paste(bg, (x + (thumb - bg.width) // 2, y + (thumb - bg.height) // 2))
    draw.text((x + 12, y + thumb + 8), key, fill="#ffffff")
target = root / ("_redraw2d_typing.png" if typing else "_redraw2d.png")
sheet.save(target)
print(target)
