"""Headless 3D acceptance sheet. Uses system Chrome directly (no playwright).

默认：12 只动物的「待机收手」态（手收在胸腹前，不在键盘上）。
加 --typing：12 只动物的「打字伸手」态（手准确按在键帽上，reach=1）。
"""
from pathlib import Path
from PIL import Image, ImageDraw
import subprocess
import sys

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
typing = "--typing" in sys.argv
out = root / ("_redraw3d_typing" if typing else "_redraw3d")
out.mkdir(exist_ok=True)
keys = ["shiba", "fox", "panda", "bunny", "penguin", "frog", "chiikawa", "grasscow", "milkdragon", "capybara", "loopy", "bubu"]

chrome = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
base = (root / "tools/model-preview.html").as_uri()
for key in keys:
    # 打字态用 ?reach=1 定格，避免无头 Chrome 虚拟时间不推进导致状态机收手。
    query = "pet=" + key + ("&t=2&reach=1&typing=left" if typing else "")
    subprocess.run([
        chrome, "--headless=new", "--disable-gpu-sandbox",
        "--use-gl=angle", "--enable-unsafe-swiftshader", "--allow-file-access-from-files",
        "--window-size=720,720",
        "--screenshot=" + str(out / f"{key}.png"),
        "--virtual-time-budget=4500",
        base + "?" + query,
    ], check=True, capture_output=True)

thumb = 320
label_h = 34
sheet = Image.new("RGB", (thumb * 4, (thumb + label_h) * 3), "#20242b")
draw = ImageDraw.Draw(sheet)
for i, key in enumerate(keys):
    im = Image.open(out / f"{key}.png").convert("RGBA")
    bg = Image.new("RGBA", im.size, "#e9e5de")
    bg.alpha_composite(im)
    bg = bg.convert("RGB")
    bg.thumbnail((thumb, thumb))
    x = (i % 4) * thumb
    y = (i // 4) * (thumb + label_h)
    sheet.paste(bg, (x + (thumb - bg.width) // 2, y + (thumb - bg.height) // 2))
    draw.text((x + 12, y + thumb + 8), key, fill="#ffffff")

target = root / ("_redraw3d_typing.png" if typing else "_redraw3d.png")
sheet.save(target)
print(target)
