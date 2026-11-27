#!/usr/bin/env python3
"""用 Playwright + 系统 Chrome 抓 GitHub 仓库页 / Release 页真图证据。"""
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent / "remotion/public/pages"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"

PAGES = [
    ("gh-repo.png", "https://github.com/daxian942-tech/DesktopPet", 1100),
    ("gh-release.png", "https://github.com/daxian942-tech/DesktopPet/releases/tag/v1.0.2", 1000),
]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        for name, url, h in PAGES:
            page = browser.new_page(viewport={"width": 1280, "height": h}, device_scale_factor=2)
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(2500)
                page.screenshot(path=str(OUT / name), full_page=False)
                print(f"saved {name} <- {url}")
            except Exception as e:
                print(f"FAIL {name}: {str(e)[:120]}")
            finally:
                page.close()
        browser.close()


if __name__ == "__main__":
    main()
