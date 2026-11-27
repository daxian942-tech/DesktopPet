"""Verify the keyboard-switch entry is visible on the first screen of both menus.

Uses only stdlib http.server + system Chrome headless (no playwright needed).
"""
from pathlib import Path
from PIL import Image, ImageDraw
import functools
import http.server
import socketserver
import subprocess
import threading

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
dist = root / "dist"
out = root / "_kb_shots"
out.mkdir(exist_ok=True)
chrome = r"C:/Program Files/Google/Chrome/Application/chrome.exe"

# Build a static preview of the right-click context menu (normally hidden).
html = (dist / "index.html").read_text(encoding="utf-8")
html = html.replace('class="context-menu hidden"', 'class="context-menu"')
inject = """
<style>
html,body{margin:0!important;background:#f4f1eb!important;width:400px!important;overflow:visible!important}
#context-menu{position:static!important;display:block!important;opacity:1!important;visibility:visible!important;
  max-height:none!important;overflow:visible!important;transform:none!important;left:auto!important;top:auto!important;
  margin:0!important;box-shadow:none!important;border-radius:0!important}
.context-menu.hidden{display:block!important}
#pet-canvas,#pet-canvas-3d,#agent-bubble,#care-quickbar,#update-toast,#tail-picker-bar{display:none!important}
</style>
"""
html = html.replace("</head>", inject + "</head>")
(dist / "_kb_context_preview.html").write_text(html, encoding="utf-8")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(dist), **kwargs)

    def log_message(self, *args):
        pass


httpd = socketserver.TCPServer(("127.0.0.1", 0), Quiet)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()

shots = [
    ("menu_appearance", "/menu.html", 520, 900),
    ("context_menu", "/_kb_context_preview.html", 400, 1000),
]
try:
    for name, path, w, h in shots:
        subprocess.run([
            chrome, "--headless=new", "--disable-gpu-sandbox",
            "--hide-scrollbars", f"--window-size={w},{h}",
            "--virtual-time-budget=2500",
            "--screenshot=" + str(out / f"{name}.png"),
            f"http://127.0.0.1:{port}{path}",
        ], check=True, capture_output=True, timeout=90)
finally:
    httpd.shutdown()
    httpd.server_close()
    (dist / "_kb_context_preview.html").unlink(missing_ok=True)

# Compose a single review sheet.
a = Image.open(out / "menu_appearance.png").convert("RGB")
b = Image.open(out / "context_menu.png").convert("RGB")
W, H = 1100, max(a.height, b.height) + 64
sheet = Image.new("RGB", (W, H), "#20242b")
sheet.paste(a, (0, 64))
sheet.paste(b, (a.width + 20, 64))
d = ImageDraw.Draw(sheet)
d.text((16, 14), "Keyboard switcher - now on the FIRST screen of both menus", fill="#ffffff")
d.text((16, 36), "Left: settings window (default Appearance tab)   |   Right: right-click menu (top of list)", fill="#9fb0c4")
d.text((10, 46), "SETTINGS / appearance", fill="#8fd6b4")
d.text((a.width + 30, 46), "RIGHT-CLICK MENU / top", fill="#8fd6b4")
dest = root / "交付产物" / "键盘切换入口-预览.png"
sheet.save(dest)
print(dest)
