# -*- coding: utf-8 -*-
"""Self-contained UI screenshot check: serves dist on an ephemeral port, shoots, exits."""
from pathlib import Path
import functools
import http.server
import socketserver
import threading

from playwright.sync_api import sync_playwright

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
dist = root / "dist"
out = root / "_ui_shots"
out.mkdir(exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(dist), **kwargs)

    def log_message(self, *args):
        pass


httpd = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=r"C:/Program Files/Google/Chrome/Application/chrome.exe",
            headless=True,
        )
        page = browser.new_page(viewport={"width": 520, "height": 880}, device_scale_factor=1)
        page.goto(f"http://127.0.0.1:{port}/menu.html")
        page.wait_for_timeout(800)
        page.locator("#context-menu").screenshot(path=str(out / "menu_appearance.png"))

        page.evaluate("() => document.querySelector('[data-tab=\"interact\"]')?.click()")
        page.wait_for_timeout(300)
        page.locator("#context-menu").screenshot(path=str(out / "menu_interact.png"))

        page.evaluate("() => document.querySelector('[data-tab=\"system\"]')?.click()")
        page.wait_for_timeout(300)
        page.locator("#context-menu").screenshot(path=str(out / "menu_system.png"))

        # Also capture the full system panel with all extension bodies expanded,
        # so no hidden control escapes visual review.
        page.evaluate("""() => {
          document.querySelectorAll('.dp-sys .collapsible-body').forEach(el => el.classList.remove('hidden'));
        }""")
        page.wait_for_timeout(200)
        page.locator("#context-menu").screenshot(path=str(out / "menu_system_expanded.png"))

        browser.close()
finally:
    httpd.shutdown()
    httpd.server_close()

print("\n".join(str(out / n) for n in [
    "menu_appearance.png", "menu_interact.png", "menu_system.png", "menu_system_expanded.png"
]))
