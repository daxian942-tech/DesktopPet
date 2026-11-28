"""打字手三态验收：待机收起 / 打字伸出 / 停手收回。直接调用系统 Chrome。"""
from pathlib import Path
from PIL import Image, ImageDraw
import subprocess

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
out = root / "_hand_pose"
out.mkdir(exist_ok=True)
chrome = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
base = (root / "tools/model-preview.html").as_uri()

# 三态用 ?reach= 固定伸缩进度（无头 Chrome 虚拟时间不推进真实 elapsed，
# 基于时间的「停手后收回」状态机无法静态截图，故直接定格关键帧）。
cases = [
    ("1-idle 待机收起 (reach=0)", "pet=shiba&t=2&reach=0"),
    ("2-typing 打字伸出 (reach=1)", "pet=shiba&t=2&reach=1&typing=left"),
    ("3-released 停手收回中 (reach=0.6)", "pet=shiba&t=2&reach=0.6"),
]

for i, (_, query) in enumerate(cases):
    subprocess.run([
        chrome, "--headless=new", "--disable-gpu-sandbox",
        "--use-gl=angle", "--enable-unsafe-swiftshader", "--allow-file-access-from-files",
        "--window-size=720,720",
        "--screenshot=" + str(out / f"case{i}.png"),
        "--virtual-time-budget=4500",
        base + "?" + query,
    ], check=True, capture_output=True)

thumb = 440
label_h = 38
sheet = Image.new("RGB", (thumb * 3, thumb + label_h), "#20242b")
draw = ImageDraw.Draw(sheet)
for i, (label, _) in enumerate(cases):
    im = Image.open(out / f"case{i}.png").convert("RGBA")
    bg = Image.new("RGBA", im.size, "#e9e5de")
    bg.alpha_composite(im)
    bg = bg.convert("RGB")
    bg.thumbnail((thumb, thumb))
    x = i * thumb
    sheet.paste(bg, (x + (thumb - bg.width) // 2, (thumb - bg.height) // 2))
    draw.text((x + 14, thumb + 11), label, fill="#ffffff")

target = root / "交付产物/手部伸缩-三态验收.png"
sheet.save(target)
print(target)
