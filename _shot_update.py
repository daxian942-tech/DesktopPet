"""验收更新 UI：底部恒定显示本地版本，检查更新不出现上游 5.1.3。

自包含 ephemeral port 服务 dist，mock __TAURI_INTERNALS__ 返回自有仓库的
UpdateInfo，截图三种状态：初始 / 已是最新 / 发现新版。
"""
import os
import socketserver
import threading
import functools
from http.server import SimpleHTTPRequestHandler

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")
OUT = os.path.join(ROOT, "_update_shots")
os.makedirs(OUT, exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


handler = functools.partial(QuietHandler, directory=DIST)
server = socketserver.TCPServer(("127.0.0.1", 0), handler)
port = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()

MOCK = r"""
window.__TAURI_INTERNALS__ = {
  invoke: async (cmd, args) => {
    const HK = 'kurocat_pet_care_v1';
    if (cmd === 'get_app_version') return '1.0.0';
    if (cmd === 'get_resolved_locale') return 'zh-CN';
    if (cmd === 'get_admin_status') return { supported: false, elevated: false };
    if (cmd === 'get_cached_update_info') return null;
    if (cmd === 'get_settings') return {
      language: 'zh-CN', scale: 1, opacity: 1, fpsCap: 0, soundEnabled: false,
      keyboardLayout: '65', keyboardTheme: 'oat', clickThroughLocked: false,
      showKeyBubbles: true, tailMode: 'auto'
    };
    if (cmd === 'get_cats') return [];
    if (cmd === 'check_for_update') {
      const mode = window.__UPDATE_MODE__ || 'current';
      if (mode === 'current') return {
        currentVersion: '1.0.0', latestVersion: '1.0.0', hasUpdate: false,
        releaseUrl: 'https://github.com/daxian942-tech/DesktopPet/releases/tag/v1.0.0',
        downloadUrl: null, assetSha256: null, assetSize: null,
        installKind: 'windows-nsis', notesSummary: ''
      };
      return {
        currentVersion: '1.0.0', latestVersion: '1.2.0', hasUpdate: true,
        releaseUrl: 'https://github.com/daxian942-tech/DesktopPet/releases/tag/v1.2.0',
        downloadUrl: 'https://github.com/daxian942-tech/DesktopPet/releases/download/v1.2.0/DesktopPet-setup-v1.2.0.exe',
        assetName: 'DesktopPet-setup-v1.2.0.exe',
        assetSha256: 'dc055c94140ca9a0c99df37059985f150e6b6a64156cc7c1585c89d17cbe689a',
        assetSize: 2405483, installKind: 'windows-nsis', notesSummary: 'new release'
      };
    }
    return null;
  },
  transformCallback: () => 1,
  onEvent: (event, handler) => { (window.__EV__ ||= {})[event] = handler; return 1; },
  removeEvent: () => {},
};
window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
  unregisterListener: () => {}
};
"""

errors = []
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            executable_path=r"C:/Program Files/Google/Chrome/Application/chrome.exe",
            args=["--use-gl=angle", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"],
        )
        page = browser.new_page(viewport={"width": 560, "height": 880}, device_scale_factor=2)
        page.add_init_script(MOCK)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://127.0.0.1:{port}/menu.html?lang=zh-CN&tab=system", wait_until="networkidle")
        page.wait_for_timeout(1800)

        hint = page.locator("#update-hint")
        print("initial footer:", hint.inner_text() if hint.count() else "NOT FOUND")
        page.screenshot(path=os.path.join(OUT, "update-01-initial.png"), full_page=True)

        # 场景一：检查更新，自有仓库返回已是最新
        page.evaluate("window.__UPDATE_MODE__ = 'current'")
        page.locator("#btn-check-update").click()
        page.wait_for_timeout(1200)
        print("after check (current):", hint.inner_text())
        page.screenshot(path=os.path.join(OUT, "update-02-up-to-date.png"), full_page=True)

        # 场景二：模拟发现新版
        page.evaluate("window.__UPDATE_MODE__ = 'new'")
        page.locator("#btn-check-update").click()
        page.wait_for_timeout(1200)
        print("after check (new):", hint.inner_text())
        page.screenshot(path=os.path.join(OUT, "update-03-update-ready.png"), full_page=True)

        body = page.locator("body").inner_text()
        print("contains 5.1.3:", "5.1.3" in body)
        browser.close()
finally:
    server.shutdown()

print("page errors:", errors if errors else "none")
