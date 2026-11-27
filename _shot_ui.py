from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
out = root / "_ui_shots"
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=r"C:/Program Files/Google/Chrome/Application/chrome.exe", headless=True)
    page = browser.new_page(viewport={"width": 520, "height": 880}, device_scale_factor=1)
    page.goto("http://127.0.0.1:4173/menu.html")
    page.wait_for_timeout(700)
    page.locator("#context-menu").screenshot(path=str(out / "menu_appearance.png"))
    page.evaluate("() => document.querySelector('[data-tab=\"interact\"]')?.click()")
    page.wait_for_timeout(250)
    page.locator("#context-menu").screenshot(path=str(out / "menu_interact.png"))
    page.evaluate("() => document.querySelector('[data-tab=\"system\"]')?.click()")
    page.wait_for_timeout(250)
    page.locator("#context-menu").screenshot(path=str(out / "menu_system.png"))
    browser.close()
print("\n".join(str(out / n) for n in ["menu_appearance.png", "menu_interact.png", "menu_system.png"]))
