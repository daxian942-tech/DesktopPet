"""扁平卡通重做后的验收图：静止 / 打字按下对比（直接调用系统 Chrome，无 playwright）。"""
from pathlib import Path
from PIL import Image, ImageDraw
import subprocess

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
out = root / "_flat_typing"
out.mkdir(exist_ok=True)
chrome = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
base = (root / "tools/model-preview.html").as_uri()

cases = [
    ("shiba-idle", "pet=shiba&t=2"),
    ("shiba-typing", "pet=shiba&t=2&typing=left"),
    ("penguin-typing", "pet=penguin&t=2&typing=right"),
    ("loopy-typing", "pet=loopy&t=2&typing=left"),
]

for name, query in cases:
    subprocess.run([
        chrome, "--headless=new", "--disable-gpu-sandbox",
        "--use-gl=angle", "--enable-unsafe-swiftshader", "--allow-file-access-from-files",
        "--window-size=720,720",
        "--screenshot=" + str(out / f"{name}.png"),
        "--virtual-time-budget=4500",
        base + "?" + query,
    ], check=True, capture_output=True)

thumb = 440
label_h = 36
sheet = Image.new("RGB", (thumb * 2, (thumb + label_h) * 2), "#20242b")
draw = ImageDraw.Draw(sheet)
for i, (name, _) in enumerate(cases):
    im = Image.open(out / f"{name}.png").convert("RGBA")
    bg = Image.new("RGBA", im.size, "#e9e5de")
    bg.alpha_composite(im)
    bg = bg.convert("RGB")
    bg.thumbnail((thumb, thumb))
    x = (i % 2) * thumb
    y = (i // 2) * (thumb + label_h)
    sheet.paste(bg, (x + (thumb - bg.width) // 2, y + (thumb - bg.height) // 2))
    draw.text((x + 14, y + thumb + 10), name, fill="#ffffff")

target = root / "交付产物/造型验收-扁平卡通与打字.png"
sheet.save(target)
print(target)
