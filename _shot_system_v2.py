# -*- coding: utf-8 -*-
"""正方形系统页验收截图：mock Tauri，520×520 下拍三个分页。"""
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
DIST = ROOT / "dist"
OUT = ROOT / "_ui_shots"
OUT.mkdir(exist_ok=True)

MOCK = r"""
window.__TAURI_INTERNALS__ = {
  invoke: async (cmd, args) => {
    if (cmd === 'get_app_version') return '1.0.2';
    if (cmd === 'get_resolved_locale') return 'zh-CN';
    if (cmd === 'get_admin_status') return { supported: false, elevated: false };
    if (cmd === 'get_cached_update_info') return null;
    if (cmd === 'get_settings') return {
      language: 'zh-CN', scale: 1, opacity: 1, fpsCap: 0, soundEnabled: true,
      typingSoundEnabled: false, keyboardLayout: '65', keyboardTheme: 'oat',
      clickThroughLocked: false, showKeyBubbles: true, tailMode: 'auto',
      renderMode: '3d', collarColor: 'none', headphoneMode: 'off', alwaysOnTop: true
    };
    if (cmd === 'get_cats') return [
      {id:'black',name:'小黑猫',emoji:'🐈‍⬛',builtin:true,furColor:'#26262b'},
      {id:'ragdoll',name:'布偶猫',emoji:'🐱',builtin:true,furColor:'#f4ece0'},
      {id:'dafeiyu',name:'大肥鱼',emoji:'🐳',builtin:true,furColor:'#7fb8e8'},
      {id:'shiba',name:'柴犬',emoji:'🐕',builtin:true,furColor:'#d98b3f'},
      {id:'fox',name:'小狐狸',emoji:'🦊',builtin:true,furColor:'#e8863c'},
      {id:'panda',name:'熊猫',emoji:'🐼',builtin:true,furColor:'#f2f2f0'},
      {id:'bunny',name:'兔子',emoji:'🐰',builtin:true,furColor:'#f6f1ea'},
      {id:'penguin',name:'企鹅',emoji:'🐧',builtin:true,furColor:'#2b3038'},
      {id:'frog',name:'青蛙',emoji:'🐸',builtin:true,furColor:'#7fbf5a'},
      {id:'chiikawa',name:'吉伊卡哇',emoji:'🐹',builtin:true,furColor:'#f3ece0'},
      {id:'grasscow',name:'草地牛',emoji:'🐮',builtin:true,furColor:'#f7f4ee'},
      {id:'milkdragon',name:'奶龙',emoji:'🐲',builtin:true,furColor:'#f6dfa6'},
      {id:'capybara',name:'水豚噜噜',emoji:'🦫',builtin:true,furColor:'#b98a5e'},
      {id:'loopy',name:'露比',emoji:'🩷',builtin:true,furColor:'#f6b9d0'},
      {id:'bubu',name:'一二布布',emoji:'🧸',builtin:true,furColor:'#d9b98c'},
    ];
    if (cmd === 'get_pet_care_state') return { hunger: 70, thirst: 62, mood: 80, energy: 75, clean: 88 };
    if (cmd === 'check_for_update') return {
      currentVersion: '1.0.2', latestVersion: '1.0.2', hasUpdate: false,
      releaseUrl: 'https://github.com/daxian942-tech/DesktopPet/releases', downloadUrl: null,
      assetSha256: null, assetSize: null, installKind: 'windows-nsis', notesSummary: ''
    };
    return null;
  },
  transformCallback: (cb) => cb,
};
window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
window.__TAURI__ = { event: { listen: async () => () => {}, emit: async () => {} } };
"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(DIST), **kw)

    def log_message(self, *a):
        pass


httpd = socketserver.TCPServer(("127.0.0.1", 0), Handler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()

try:
    with sync_playwright() as p:
        b = p.chromium.launch(
            executable_path=r"C:/Program Files/Google/Chrome/Application/chrome.exe",
            headless=True,
        )
        pg = b.new_page(viewport={"width": 520, "height": 520}, device_scale_factor=2)
        pg.add_init_script(MOCK)
        # 预置两条提醒，验收「互动」页的提醒列表
        pg.add_init_script("""
          try {
            localStorage.setItem('desktop-pet-reminders-v1', JSON.stringify([
              {id:'r1', time:'09:30', text:'起来喝水，别一直坐着', repeat:'daily', enabled:true},
              {id:'r2', time:'14:00', text:'开会前整理一下周报', repeat:'once', enabled:false}
            ]));
          } catch (e) {}
        """)
        pg.goto(f"http://127.0.0.1:{port}/menu.html")
        pg.wait_for_timeout(1200)

        for tab, name in [("appearance", "外观"), ("interact", "互动"), ("system", "系统")]:
            pg.evaluate(
                "(t) => document.querySelector('[data-tab=\"' + t + '\"]')?.click()", tab
            )
            pg.wait_for_timeout(400)
            pg.locator("#context-menu").screenshot(path=str(OUT / f"sys2-{tab}.png"))
            print(f"{name} 截图完成")

        # 系统页展开扩展功能
        pg.evaluate(
            "() => document.querySelectorAll('.dp-sys .collapsible-body')"
            ".forEach(el => el.classList.remove('hidden'))"
        )
        pg.wait_for_timeout(300)
        pg.locator("#context-menu").screenshot(path=str(OUT / "sys2-system-expanded.png"))
        print("系统页展开 截图完成")
        b.close()
finally:
    httpd.shutdown()
    httpd.server_close()
