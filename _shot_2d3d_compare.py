"""把 12 只动物的 2D 与 3D 待机态并排拼成一张风格统一验收图。"""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
d2 = root / "_redraw2d"
d3 = root / "_redraw3d"
keys = ["shiba", "fox", "panda", "bunny", "penguin", "frog",
        "chiikawa", "grasscow", "milkdragon", "capybara", "loopy", "bubu"]

cell_w, cell_h = 340, 340
sheet = Image.new("RGB", (cell_w * 4, cell_h * 3), "#20242b")
draw = ImageDraw.Draw(sheet)

for i, key in enumerate(keys):
    x = (i % 4) * cell_w
    y = (i // 4) * cell_h
    for j, (folder, tag, bg) in enumerate([
        (d2, "2D", "#f4f1eb"),
        (d3, "3D", "#e9e5de"),
    ]):
        im = Image.open(folder / f"{key}.png").convert("RGBA")
        base = Image.new("RGBA", im.size, bg)
        base.alpha_composite(im)
        im = base.convert("RGB")
        im.thumbnail((cell_w - 16, 140))
        ox = x + 8 + ((cell_w - 16) - im.width) // 2
        oy = y + 6 + j * 150 + (140 - im.height) // 2
        sheet.paste(im, (ox, oy))
        draw.text((x + 12, y + 6 + j * 150), tag, fill="#8899aa")
    draw.text((x + cell_w - 92, y + cell_h - 24), key, fill="#ffffff")

target = root / "交付产物/2D与3D风格统一验收.png"
sheet.save(target)
print(target)
