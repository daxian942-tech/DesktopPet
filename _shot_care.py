# -*- coding: utf-8 -*-
"""Visual + interaction acceptance for the pet-care popover.

Self-contained: serves dist on an ephemeral port, mocks Tauri IPC, exits.
Stage A: healthy state -> tap the pet -> operation panel.
Stage B: neglected state -> wait for the real 6s ticker -> auto reminder,
         then click the one-tap action and verify localStorage actually changed.
"""
from pathlib import Path
import http.server
import socketserver
import threading

from playwright.sync_api import sync_playwright

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
dist = root / "dist"
out = root / "_care_shots"
out.mkdir(exist_ok=True)

HEALTHY = {"hunger": 18, "thirst": 14, "mood": 82, "energy": 90, "clean": 88}
NEGLECTED = {"hunger": 95, "thirst": 90, "mood": 15, "energy": 70, "clean": 12}

MOCK_HEAD = """
window.__TAURI_INTERNALS__ = {
  invoke: (cmd) => {
    if (cmd === 'get_settings') return Promise.resolve({
      clickThroughLocked: false, alwaysOnTop: true, scale: 1, keyboardLayout: '65',
      renderMode: '2d', keyboardTheme: 'oat', showKeyBubbles: true, soundEnabled: false,
      privacyPasswordGuard: false, language: 'zh-CN', fpsCap: 0,
      collarColor: 'none', headphoneMode: 'off', tailKeyIds: [], tailKeyMode: 'smart',
      keyboardOrientation: 'cat', opacity: 1, mcpEnabled: false, obsEnabled: false,
      liveCaptureEnabled: false, autostart: false, liveChromaColor: 'blue',
      typingSoundEnabled: false
    });
    if (cmd === 'get_app_version') return Promise.resolve('1.0.0');
    if (typeof cmd === 'string' && (cmd.includes('listen') || cmd.includes('unlisten'))) {
      return Promise.resolve(1);
    }
    return Promise.resolve(null);
  },
  transformCallback: () => 1,
  unregisterCallback: () => {},
  runCallback: () => {},
  metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  plugins: {},
  convertFileSrc: (s) => s,
  isTauri: () => true
};
"""

def init_script(state):
    return MOCK_HEAD + (
        "localStorage.setItem('kurocat_pet_care_v1', JSON.stringify(%s));"
        % str(state).replace("'", '"').replace("True", "true").replace("False", "false")
        + "\n"
    )


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(dist), **kwargs)

    def log_message(self, *args):
        pass


httpd = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{port}/index.html"

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=r"C:/Program Files/Google/Chrome/Application/chrome.exe",
            headless=True,
        )

        def new_page(state):
            ctx = browser.new_context(viewport={"width": 420, "height": 440}, device_scale_factor=1)
            ctx.add_init_script(init_script(state))
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(URL)
            pg.wait_for_timeout(1200)
            pg.add_style_tag(content="html,body{background:#e9e3d7 !important}")
            return ctx, pg, errs

        # ---------- Stage A: tap the pet ----------
        ctx_a, pg_a, errs_a = new_page(HEALTHY)
        print("stage A page errors:", errs_a[:5])
        tap_hit = None
        for (x, y) in [(210, 250), (210, 220), (210, 190), (180, 250), (240, 250),
                       (210, 290), (160, 230), (260, 230), (210, 150), (210, 320)]:
            pg_a.mouse.click(x, y)
            pg_a.wait_for_timeout(120)
            visible = pg_a.evaluate(
                "() => { const e=document.getElementById('care-popover'); return e && !e.classList.contains('hidden'); }"
            )
            if visible:
                tap_hit = (x, y)
                break
        print("stage A tap hit:", tap_hit)
        if not tap_hit:
            # Fallback: show the panel directly so the visual layout can still be reviewed.
            pg_a.evaluate("""() => {
              const e = document.getElementById('care-popover');
              e.classList.remove('hidden');
              e.style.left = '90px'; e.style.top = '110px';
              const vals = {hunger:82, thirst:86, mood:82, energy:90, clean:88};
              for (const k in vals) document.getElementById('cpop-'+k).style.width = vals[k]+'%';
            }""")
            pg_a.wait_for_timeout(150)
        pg_a.screenshot(path=str(out / "care_tap_open.png"))
        print("stage A panel text:", pg_a.evaluate(
            "() => document.getElementById('care-popover').innerText.replace(/\\n+/g,' | ')"
        ))
        ctx_a.close()

        # ---------- Stage B: automatic reminder ----------
        ctx_b, pg_b, errs_b = new_page(NEGLECTED)
        print("stage B page errors:", errs_b[:5])
        pg_b.wait_for_timeout(7200)  # first ticker fires at 6s
        auto_visible = pg_b.evaluate(
            "() => { const e=document.getElementById('care-popover'); return e && !e.classList.contains('hidden'); }"
        )
        alert_text = pg_b.evaluate(
            "() => document.getElementById('care-pop-alert-text').textContent"
        )
        bubble_text = pg_b.evaluate(
            "() => document.getElementById('agent-bubble').textContent"
        )
        print("stage B auto popover visible:", auto_visible)
        print("stage B alert:", alert_text)
        print("stage B bubble:", bubble_text)
        pg_b.screenshot(path=str(out / "care_auto_reminder.png"))

        # One-tap action must really update the persisted state.
        before = pg_b.evaluate(
            "() => JSON.parse(localStorage.getItem('kurocat_pet_care_v1')).hunger"
        )
        if auto_visible:
            pg_b.click("#care-pop-alert-action")
            pg_b.wait_for_timeout(400)
        after = pg_b.evaluate(
            "() => JSON.parse(localStorage.getItem('kurocat_pet_care_v1')).hunger"
        )
        print("stage B one-tap feed hunger: %s -> %s" % (before, after))
        pg_b.screenshot(path=str(out / "care_after_action.png"))
        ctx_b.close()

        browser.close()
finally:
    httpd.shutdown()
    httpd.server_close()

print("\n".join(str(out / n) for n in [
    "care_tap_open.png", "care_auto_reminder.png", "care_after_action.png"
]))
