"""Generate the DesktopPet icon, tray icon and NSIS artwork.

Design: warm paper, persimmon block, cream lowercase "dp", sage status dot.
Run from the repository root with Pillow available.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "src-tauri" / "icons"
S = 4  # supersampling


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/seguisb.ttf") if not bold else Path("C:/Windows/Fonts/segoeuib.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size * S)
    return ImageFont.load_default()


def linear_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        color = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        for x in range(w):
            px[x, y] = color
    return img


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def make_app_icon(px: int = 1024) -> Image.Image:
    size = (px * S, px * S)
    grad = linear_gradient(size, (240, 132, 95), (205, 79, 52)).convert("RGBA")
    mask = rounded_mask(size, int(px * S * 0.225))
    icon = Image.new("RGBA", size, (0, 0, 0, 0))
    icon.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(icon)
    # Quiet paper arc for depth, kept away from the lettering.
    d.arc(
        (-int(px * S * 0.35), int(px * S * 0.10), int(px * S * 0.86), int(px * S * 0.93)),
        start=198,
        end=338,
        fill=(255, 246, 233, 60),
        width=max(2, int(px * S * 0.027)),
    )
    f = font(int(px * 0.46), bold=True)
    text = "dp"
    box = d.textbbox((0, 0), text, font=f)
    tw, th = box[2] - box[0], box[3] - box[1]
    d.text(
        ((size[0] - tw) / 2 - box[0], (size[1] - th) / 2 - box[1] - int(px * S * 0.025)),
        text,
        font=f,
        fill=(255, 248, 238, 255),
    )
    # Sage dot signals "companion online" rather than a literal cat mark.
    r = int(px * S * 0.058)
    cx, cy = int(px * S * 0.775), int(px * S * 0.225)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(126, 163, 141, 255))
    return icon.resize((px, px), Image.Resampling.LANCZOS)


def make_wordmark_banner(width: int, height: int, compact: bool = False) -> Image.Image:
    w, h = width * S, height * S
    bg = linear_gradient((w, h), (253, 249, 241), (241, 230, 214)).convert("RGBA")
    d = ImageDraw.Draw(bg)
    # Warm top edge and left accent rail.
    d.rectangle((0, 0, w, max(2, 3 * S)), fill=(229, 111, 79, 255))
    if not compact:
        d.rectangle((0, 0, 7 * S, h), fill=(229, 111, 79, 255))
        d.rectangle((7 * S, 0, 9 * S, h), fill=(111, 146, 126, 255))

    logo_size = (44 if compact else 68) * S
    logo = make_app_icon(logo_size // S).resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    lx = (10 if compact else 48) * S
    ly = (7 if compact else 28) * S
    bg.alpha_composite(logo, (lx, ly))

    if compact:
        x = 62 * S
        name_font = font(16, bold=True)
        d.text((x, 15 * S), "DesktopPet", font=name_font, fill=(45, 43, 42, 255))
        sub_font = font(6, bold=False)
        d.text((x + S, 35 * S), "DESKTOP COMPANION", font=sub_font, fill=(139, 131, 121, 255))
    else:
        name_font = font(15, bold=True)
        name = "DesktopPet"
        box = d.textbbox((0, 0), name, font=name_font)
        d.text(((w - (box[2] - box[0])) / 2, 108 * S), name, font=name_font, fill=(45, 43, 42, 255))
        sub_font = font(7, bold=True)
        tag = "DESKTOP COMPANION"
        box = d.textbbox((0, 0), tag, font=sub_font)
        d.text(((w - (box[2] - box[0])) / 2, 130 * S), tag, font=sub_font, fill=(111, 146, 126, 255))
        d.rectangle((60 * S, 148 * S, 102 * S, 150 * S), fill=(229, 111, 79, 255))
        detail_font = font(8, bold=False)
        for i, line in enumerate(("Custom animals", "Pet care  ·  3 keyboards")):
            box = d.textbbox((0, 0), line, font=detail_font)
            d.text(((w - (box[2] - box[0])) / 2, (160 + i * 17) * S), line, font=detail_font, fill=(95, 90, 84, 255))
        tiny = font(6, bold=False)
        footer = "PERSONAL DESKTOP EDITION"
        box = d.textbbox((0, 0), footer, font=tiny)
        d.text(((w - (box[2] - box[0])) / 2, 286 * S), footer, font=tiny, fill=(139, 131, 121, 255))

    return bg.resize((width, height), Image.Resampling.LANCZOS).convert("RGB")


def main() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    master = make_app_icon(1024)
    master.save(ICONS / "source-artwork.png")
    master.save(ICONS / "icon.png")

    sizes = {"32x32.png": 32, "128x128.png": 128, "128x128@2x.png": 256, "256x256.png": 256}
    for name, size in sizes.items():
        master.resize((size, size), Image.Resampling.LANCZOS).save(ICONS / name)
    master.resize((32, 32), Image.Resampling.LANCZOS).save(ICONS / "tray-icon.png")

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    frames = [master.resize((s, s), Image.Resampling.LANCZOS) for s in ico_sizes]
    frames[-1].save(ICONS / "icon.ico", format="ICO", sizes=[(s, s) for s in ico_sizes])

    make_wordmark_banner(164, 314).save(ICONS / "nsis-sidebar.bmp")
    make_wordmark_banner(150, 57, compact=True).save(ICONS / "nsis-header.bmp")
    print("DesktopPet brand assets written to", ICONS)


if __name__ == "__main__":
    main()
