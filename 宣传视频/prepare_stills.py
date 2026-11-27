#!/usr/bin/env python3
"""把单只动物 720x720 图去背，产出两类竖屏视频素材：
  stills/<id>-full.png   整图去背（保留键盘，桌面场景）
  stills/<id>-pet.png    只留动物主体（裁掉键盘/鼠标，透明底，特写用）

背景是精确纯色 #e9e5de (233,229,222)，用色差阈值 + 边缘羽化去背。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent / "_redraw3d"
DST = ROOT / "remotion/public/stills"
BG = np.array([233, 229, 222], dtype=np.int16)

IDS = ["milkdragon", "grasscow", "chiikawa", "loopy", "bubu", "capybara",
       "shiba", "fox", "panda", "bunny", "penguin", "frog"]


def keyout(im: Image.Image, tol: int = 18, feather: bool = True) -> Image.Image:
    rgba = im.convert("RGBA")
    arr = np.array(rgba).astype(np.int16)
    diff = np.abs(arr[:, :, :3] - BG).sum(axis=2)
    alpha = np.where(diff <= tol, 0, 255).astype(np.uint8)
    if feather:
        # 对近背景过渡带做软化，避免锯齿
        soft = np.clip((diff - tol) * 12, 0, 255).astype(np.uint8)
        alpha = np.minimum(alpha, soft)
    rgba.putalpha(Image.fromarray(alpha, "L").filter(ImageFilter.GaussianBlur(0.6)))
    return rgba


def crop_pet(im: Image.Image) -> Image.Image:
    """裁掉下半部键盘：动物主体大致在 y=120..520，键盘在 y>500。按 alpha 内容自动取上箱体。"""
    a = np.array(im.getchannel("A"))
    ys, xs = np.where(a > 40)
    if not len(ys):
        return im
    # 键盘是独立的下方连通区；简单规则：取 y < 520 的主体
    mask = ys < 520
    if mask.sum() > 200:
        ys2, xs2 = ys[mask], xs[mask]
    else:
        ys2, xs2 = ys, xs
    x0, x1 = max(0, xs2.min() - 20), min(im.width, xs2.max() + 20)
    y0, y1 = max(0, ys2.min() - 20), min(im.height, ys2.max() + 20)
    return im.crop((x0, y0, x1, y1))


def main():
    DST.mkdir(parents=True, exist_ok=True)
    for pet in IDS:
        src = SRC / f"{pet}.png"
        if not src.exists():
            print(f"skip {pet}: 无源图")
            continue
        im = Image.open(src).convert("RGB")
        full = keyout(im)
        full.save(DST / f"{pet}-full.png")
        pet_only = crop_pet(full)
        # 放大到统一高度 900 方便竖屏排版
        scale = 900 / pet_only.height
        pet_only = pet_only.resize(
            (int(pet_only.width * scale), 900), Image.LANCZOS
        )
        pet_only.save(DST / f"{pet}-pet.png")
        print(f"{pet}: full={full.size} pet={pet_only.size}")


if __name__ == "__main__":
    main()
