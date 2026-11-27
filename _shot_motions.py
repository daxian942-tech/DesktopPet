"""Capture each IP at rest and at its signature-action peak using headless Chrome."""
from pathlib import Path
from PIL import Image, ImageDraw
import subprocess

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
out = root / "_motions"
out.mkdir(exist_ok=True)
# virtual-time budget (ms) at which each signature beat reaches its peak
peaks = {
    "chiikawa": 4700,
    "grasscow": 3800,
    "milkdragon": 4300,
    "capybara": 3300,
    "loopy": 5200,
    "bubu": 4600,
}

chrome = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
base = (root / "tools/model-preview.html").as_uri()
for key, peak in peaks.items():
    for phase, t in (("rest", 0.9), ("action", peak / 1000)):
        subprocess.run([
            chrome, "--headless=new", "--disable-gpu-sandbox",
            "--use-gl=angle", "--enable-unsafe-swiftshader", "--allow-file-access-from-files",
            "--window-size=720,720",
            "--screenshot=" + str(out / f"{key}-{phase}.png"),
            "--virtual-time-budget=3500",
            base + "?pet=" + key + "&t=" + str(t),
        ], check=True, capture_output=True)

thumb = 300
label_h = 30
keys = list(peaks)
sheet = Image.new("RGB", (thumb * 2, (thumb + label_h) * len(keys)), "#20242b")
draw = ImageDraw.Draw(sheet)
for row, key in enumerate(keys):
    for col, phase in enumerate(["rest", "action"]):
        im = Image.open(out / f"{key}-{phase}.png").convert("RGBA")
        bg = Image.new("RGBA", im.size, "#e9e5de")
        bg.alpha_composite(im)
        bg = bg.convert("RGB")
        bg.thumbnail((thumb, thumb))
        x, y = col * thumb, row * (thumb + label_h)
        sheet.paste(bg, (x + (thumb - bg.width) // 2, y + (thumb - bg.height) // 2))
        draw.text((x + 10, y + thumb + 7), f"{key} / {phase}", fill="#ffffff")
sheet.save(root / "_motions.png")
print(root / "_motions.png")
