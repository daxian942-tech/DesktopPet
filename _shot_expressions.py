"""Expression / typing acceptance sheets for the six IP animals (2D + 3D)."""
from pathlib import Path
from PIL import Image, ImageDraw
import subprocess

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
chrome = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
keys = ["chiikawa", "grasscow", "milkdragon", "capybara", "loopy", "bubu"]
states = [
    ("idle", "t=2"),
    ("happy", "mood=happy&t=2"),
    ("love", "t=11.5"),
    ("surprised", "t=18.2"),
    ("worried", "t=24.7"),
    ("typing", "typing=left&t=8.37"),
]
cell = 250
label_h = 30


def shoot(url, path, query):
    subprocess.run([
        chrome, "--headless=new", "--disable-gpu-sandbox",
        "--use-gl=angle", "--enable-unsafe-swiftshader", "--allow-file-access-from-files",
        "--window-size=520,520",
        "--screenshot=" + str(path),
        "--virtual-time-budget=3200",
        url + "?" + query,
    ], check=True, capture_output=True)


def build_sheet(path, image_dir, prefix, base, query_fn):
    image_dir.mkdir(exist_ok=True)
    for key in keys:
        for name, params in states:
            shoot(base, image_dir / f"{prefix}_{key}_{name}.png", query_fn(key, params))
    sheet = Image.new("RGB", (cell * len(states), (cell + label_h) * len(keys)), "#20242b")
    draw = ImageDraw.Draw(sheet)
    for row, key in enumerate(keys):
        for col, (name, _) in enumerate(states):
            im = Image.open(image_dir / f"{prefix}_{key}_{name}.png").convert("RGBA")
            bg = Image.new("RGBA", im.size, "#e9e5de" if prefix == "3d" else "#f4f1eb")
            bg.alpha_composite(im)
            bg = bg.convert("RGB")
            bg.thumbnail((cell, cell))
            x = col * cell
            y = row * (cell + label_h)
            sheet.paste(bg, (x + (cell - bg.width) // 2, y + (cell - bg.height) // 2))
            draw.text((x + 8, y + cell + 6), f"{key} / {name}", fill="#ffffff")
    sheet.save(path)
    print(path)


build_sheet(
    root / "_expressions3d.png", root / "_expr3d", "3d",
    (root / "tools/model-preview.html").as_uri(),
    lambda key, params: f"pet={key}&{params}",
)
build_sheet(
    root / "_expressions2d.png", root / "_expr2d", "2d",
    (root / "tools/animal-studio.html").as_uri(),
    lambda key, params: f"shot={key}&{params}",
)
