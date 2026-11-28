"""验收：桌宠缩小时头顶照顾快捷栏仍完整可见、不被裁切。"""
from pathlib import Path
from PIL import Image, ImageDraw
import subprocess

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
out = root / "_care_quickbar"
out.mkdir(exist_ok=True)
chrome = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
base = (root / "交付产物/头顶快捷按钮-验证页.html").as_uri()

cases = [
    ("20% 65键 100×100", 100, 100),
    ("30% 65键 126×132", 126, 132),
    ("40% 65键 168×176", 168, 176),
    ("60% 65键 252×264", 252, 264),
    ("100% 65键 420×440", 420, 440),
]

for i, (_, w, h) in enumerate(cases):
    shot = out / f"case{i}.png"
    subprocess.run([
        chrome, "--headless=new", "--disable-gpu-sandbox",
        "--hide-scrollbars", "--allow-file-access-from-files",
        "--window-size=700,620",
        f"--screenshot={shot}",
        "--virtual-time-budget=1200",
        f"{base}?w={w}&h={h}",
    ], check=True, capture_output=True)
    # 验证页 body 有 10px padding，按真实窗口尺寸裁出桌宠窗口区域。
    with Image.open(shot) as im:
        im.crop((10, 10, 10 + w, 10 + h)).save(shot)

thumb_w, thumb_h = 320, 360
label_h = 34
cols = len(cases)
sheet = Image.new("RGB", (thumb_w * cols, thumb_h + label_h), "#20242b")
draw = ImageDraw.Draw(sheet)
for i, (label, _, _) in enumerate(cases):
    im = Image.open(out / f"case{i}.png").convert("RGB")
    im.thumbnail((thumb_w, thumb_h - 24), Image.Resampling.LANCZOS)
    x = i * thumb_w
    sheet.paste(im, (x + (thumb_w - im.width) // 2, 12 + ((thumb_h - 24 - im.height) // 2)))
    draw.text((x + 10, thumb_h + 9), label, fill="#ffffff")

target = root / "交付产物/头顶快捷按钮-缩小时验收.png"
sheet.save(target)
print(target)
