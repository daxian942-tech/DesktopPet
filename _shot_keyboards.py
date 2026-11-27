from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
out = root / "_keyboard_shots"
out.mkdir(exist_ok=True)
themes = [("oat", "OAT CREAM"), ("mist", "MIST NAVY"), ("clay", "TERRACOTTA")]
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=r"C:/Program Files/Google/Chrome/Application/chrome.exe",
        headless=True,
        args=["--use-gl=angle", "--enable-unsafe-swiftshader", "--allow-file-access-from-files"],
    )
    page = browser.new_page(viewport={"width": 720, "height": 720}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto((root / "tools/model-preview.html").as_uri())
    page.wait_for_function("() => typeof window.showPet === 'function'", timeout=60000)
    page.evaluate("() => showPet('shiba')")
    for key, _ in themes:
        page.evaluate("key => petEngine.setKeyboardTheme(key)", key)
        page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        page.locator("#pet").screenshot(path=str(out / f"{key}.png"))
    browser.close()
    if errors:
        raise RuntimeError("\n".join(errors))

thumb = 420
label_h = 36
sheet = Image.new("RGB", (thumb * 3, thumb + label_h), "#20242b")
draw = ImageDraw.Draw(sheet)
for i, (key, label) in enumerate(themes):
    im = Image.open(out / f"{key}.png").convert("RGB")
    im.thumbnail((thumb, thumb))
    x = i * thumb
    sheet.paste(im, (x + (thumb - im.width) // 2, (thumb - im.height) // 2))
    draw.text((x + 14, thumb + 10), label, fill="#ffffff")
sheet.save(root / "_keyboard_themes.png")
print(root / "_keyboard_themes.png")
