"""为 60 秒抖音功能介绍视频截取真实桌宠引擎素材并去背。

素材全部来自项目自己的预览页（真实 KuroCatEngine / KuroCatEngine3D），
不是手绘示意图，所以跳跃时键盘留在桌面、喝水/洗澡的碗与水泡都是真实效果。
输出：_video_assets/<name>.png（RGBA 透明底，统一 1000x1000 画布）
"""
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
OUT = ROOT / "_video_assets"
OUT.mkdir(exist_ok=True)
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"

CARE = (ROOT / "tools/care-2d.html").as_uri()
PREVIEW = (ROOT / "tools/model-preview.html").as_uri()

# name -> (页面, 查询串, 背景色, 是否 3D)
SHOTS = {
    "idle_2d":     (CARE,    "",                                         (244, 241, 235), False),
    "charge_2d":   (CARE,    "?pet=black&jump=charge&jumpAmt=1",       (244, 241, 235), False),
    "air_2d":      (CARE,    "?pet=black&jump=air&jumpAmt=1",          (244, 241, 235), False),
    "land_2d":     (CARE,    "?pet=black&jump=land",                    (244, 241, 235), False),
    "eat_2d":      (CARE,    "?pet=black&mood=eat&t=2",                 (244, 241, 235), False),
    "drink_2d":    (CARE,    "?pet=black&mood=drink&t=2",               (244, 241, 235), False),
    "play_2d":     (CARE,    "?pet=black&mood=play&t=2",                (244, 241, 235), False),
    "bath_2d":     (CARE,    "?pet=black&mood=bath&t=2",                (244, 241, 235), False),
    "idle_3d":     (PREVIEW, "?pet=black&t=2",                          (233, 229, 222), True),
    "charge_3d":   (PREVIEW, "?pet=black&t=2&jump=charge&jumpAmt=1",    (233, 229, 222), True),
    "air_3d":      (PREVIEW, "?pet=black&t=2&jump=air&jumpAmt=1",       (233, 229, 222), True),
    "drink_3d":    (PREVIEW, "?pet=black&t=2&mood=drink",               (233, 229, 222), True),
    "bath_3d":     (PREVIEW, "?pet=black&t=2&mood=bath",                (233, 229, 222), True),
}

STILLS = ROOT / "宣传视频/remotion/public/stills"
PET_IDS = ["shiba", "milkdragon", "capybara", "chiikawa", "grasscow", "loopy",
           "bubu", "fox", "panda", "bunny", "penguin", "frog"]


def shoot(url, dest, gl=False):
    cmd = [CHROME, "--headless=new", "--disable-gpu-sandbox",
           "--window-size=1000,1000", "--screenshot=" + str(dest),
           "--virtual-time-budget=6000"]
    if gl:
        cmd += ["--use-gl=angle", "--enable-unsafe-swiftshader",
                "--allow-file-access-from-files"]
    cmd.append(url)
    subprocess.run(cmd, check=True, capture_output=True)


def cutout(src, bg, tol=20):
    im = Image.open(src).convert("RGBA")
    arr = np.array(im).astype(np.int16)
    diff = np.abs(arr[:, :, :3] - np.array(bg, dtype=np.int16)).sum(axis=2)
    alpha = np.where(diff <= tol, 0, 255).astype(np.uint8)
    soft = np.clip((diff - tol) * 10, 0, 255).astype(np.uint8)
    alpha = np.minimum(alpha, soft)
    a = Image.fromarray(alpha, "L").filter(ImageFilter.GaussianBlur(0.7))
    im.putalpha(a)
    return im


def normalize(im, size=1000, pad=36):
    """裁到内容外接框，等比缩放居中放进 size x size 透明画布。"""
    bbox = im.getchannel("A").getbbox()
    if not bbox:
        return im.resize((size, size), Image.LANCZOS)
    im = im.crop(bbox)
    avail = size - pad * 2
    scale = min(avail / im.width, avail / im.height)
    im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return canvas


def build_pets_grid():
    """结尾镜头：12 只动物（复用工程已有的去背特写图）拼 4x3 网格。"""
    cell = 300
    grid = Image.new("RGBA", (cell * 4, cell * 3), (0, 0, 0, 0))
    for i, pid in enumerate(PET_IDS):
        src = STILLS / f"{pid}-pet.png"
        if not src.exists():
            print("  missing still:", pid)
            continue
        im = Image.open(src).convert("RGBA")
        im.thumbnail((cell - 24, cell - 24), Image.LANCZOS)
        x = (i % 4) * cell + (cell - im.width) // 2
        y = (i // 4) * cell + (cell - im.height) // 2
        grid.alpha_composite(im, (x, y))
    out = Image.new("RGBA", (1000, 1000), (0, 0, 0, 0))
    grid.thumbnail((940, 940), Image.LANCZOS)
    out.alpha_composite(grid, ((1000 - grid.width) // 2, (1000 - grid.height) // 2))
    out.save(OUT / "pets_grid.png")
    print("saved pets_grid.png")


def main():
    for name, (page, qs, bg, gl) in SHOTS.items():
        raw = OUT / f"_{name}_raw.png"
        print(f"[{name}] shooting...")
        shoot(page + qs, raw, gl=gl)
        im = cutout(raw, bg)
        normalize(im).save(OUT / f"{name}.png")
        raw.unlink(missing_ok=True)
        print(f"  -> {name}.png")
    build_pets_grid()
    print("all assets in", OUT)


if __name__ == "__main__":
    main()
