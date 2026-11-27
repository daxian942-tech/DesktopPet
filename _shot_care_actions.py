#!/usr/bin/env python3
"""验收：各物种的进食 / 喝水专属动作（2D 渲染）。"""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "宣传视频" / "qa" / "care"
OUT.mkdir(parents=True, exist_ok=True)

SPECIES = [
    ("grasscow", "草地牛"),
    ("dog", "柴犬"),
    ("bunny", "兔子"),
    ("milkdragon", "奶龙"),
    ("loopy", "露比"),
    ("bubu", "布布"),
]
MOODS = [("idle", "常态"), ("eat", "进食"), ("drink", "喝水")]

HTML = """<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f1eb">
<canvas id="c" width="420" height="440"></canvas>
<script src="file:///{bundle}"></script>
<script>
window.draw = function(species, mood, t) {{
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  KuroSpecies2D.renderWith(ctx, {{species: species, furColor: '#ffffff', eyeColorTop:'#2a2521'}}, c.width, c.height, t, mood, 0);
}};
</script></body></html>"""


def main():
    bundle = ROOT / "tools" / "species-renderer.js"
    html_path = ROOT / "_care_preview.html"
    html_path.write_text(HTML.format(bundle=str(bundle).replace("\\", "/")), encoding="utf-8")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=r"C:/Program Files/Google/Chrome/Application/chrome.exe",
            headless=True,
        )
        page = browser.new_page(viewport={"width": 420, "height": 440}, device_scale_factor=2)
        page.goto(html_path.as_uri(), wait_until="load")
        page.wait_for_timeout(500)
        for sp, cn in SPECIES:
            for mood, mcn in MOODS:
                page.evaluate("([s,m,t]) => window.draw(s,m,t)", [sp, mood, 1.2])
                page.screenshot(path=str(OUT / f"{sp}-{mood}.png"))
                print(f"{cn} · {mcn}")
        browser.close()
    html_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
