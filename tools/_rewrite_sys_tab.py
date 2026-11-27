# -*- coding: utf-8 -*-
"""Rewrite the System tab into a flat, minimal layout and add its i18n keys."""
import pathlib

ROOT = pathlib.Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")

NEW_SYS_TAB = """        <!-- Tab 3: System - flat minimal layout (redesigned, not the original card stack) -->
        <div class="tab-panel hidden" data-tab-panel="system">
          <section class="dp-sys">
            <div class="dp-sys-hero">
              <span class="dp-sys-logo" aria-hidden="true">dp</span>
              <span class="dp-sys-hero-text">
                <strong>DesktopPet</strong>
                <small data-i18n="menu.sys_initial_edition">初版 · v1.0.0</small>
              </span>
              <span class="dp-sys-status"><i aria-hidden="true"></i><span data-i18n="menu.sys_running">运行中</span></span>
            </div>

            <div class="dp-sys-group">
              <div class="dp-sys-group-title" data-i18n="menu.sys_group_basic">基础</div>
              <div class="dp-sys-list">
                <button class="toggle-row" data-action="toggle-top" type="button" role="switch" aria-checked="true" id="sw-top">
                  <span class="toggle-label" data-i18n="menu.toggle_top">始终置顶显示</span>
                  <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
                </button>
                <button class="toggle-row" data-action="toggle-autostart" type="button" role="switch" aria-checked="false" id="sw-autostart">
                  <span class="toggle-label" data-i18n="menu.toggle_autostart">开机自动启动</span>
                  <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
                </button>
                <div class="setting-row">
                  <span class="setting-label" data-i18n="menu.fps_short">帧率上限</span>
                  <div class="seg-control seg-2">
                    <button class="seg-btn active" data-fpscap="0" data-i18n="menu.fps_auto" type="button">60 流畅</button>
                    <button class="seg-btn" data-fpscap="30" data-i18n="menu.fps_eco" type="button">30 省电</button>
                  </div>
                </div>
                <div class="setting-row">
                  <label class="setting-label" for="lang-select" data-i18n="menu.lang_short">界面语言</label>
                  <div class="select-wrap">
                    <select class="lang-select" id="lang-select">
                      <option value="auto" data-i18n="menu.lang_auto">跟随系统</option>
                      <option value="zh-CN">简体中文</option>
                      <option value="zh-TW">繁體中文</option>
                      <option value="en-US">English</option>
                      <option value="ja-JP">日本語</option>
                      <option value="ko-KR">한국어</option>
                    </select>
                    <svg class="select-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M6 9l6 6 6-6"></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div class="dp-sys-group">
              <div class="dp-sys-group-title" data-i18n="menu.sys_group_actions">快捷操作</div>
              <div class="dp-sys-links sys-action-row" id="sys-action-row">
                <button class="sub-action-btn" data-action="reset-pos" type="button" data-i18n-title="menu.reset_pos" title="重置位置到右下角">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path>
                    <path d="M3 3v5h5"></path>
                  </svg>
                  <span data-i18n="menu.reset_pos_short">重置位置</span>
                </button>
                <button class="sub-action-btn" data-action="desktop-shortcut" id="btn-desktop-shortcut" type="button" data-i18n-title="menu.desktop_shortcut" title="创建桌面图标">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14"></path>
                  </svg>
                  <span id="shortcut-hint" data-i18n="menu.desktop_shortcut_short">桌面图标</span>
                </button>
                <button class="sub-action-btn admin-restart-btn hidden" data-action="restart-admin" id="btn-restart-admin" type="button" data-i18n-title="menu.admin_restart" title="以管理员身份重启（捕获游戏键鼠）">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"></path>
                  </svg>
                  <span id="admin-restart-label" data-i18n="menu.admin_restart">以管理员身份重启（捕获游戏键鼠）</span>
                </button>
                <button class="sub-action-btn admin-restart-btn hidden" data-action="mac-input-diag" id="btn-mac-input-diag" type="button" data-i18n-title="menu.mac_input_diag" title="输入监控诊断（修复按键无响应）">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"></path>
                  </svg>
                  <span id="mac-input-diag-label" data-i18n="menu.mac_input_diag">输入监控诊断（修复按键无响应）</span>
                </button>
              </div>
            </div>

            <div class="dp-sys-group dp-sys-group-ext">
              <div class="dp-sys-group-title" data-i18n="menu.sys_group_ext">扩展功能</div>
              <div class="dp-sys-list dp-sys-ext-list">
                <section class="menu-card collapsible-card" id="mcp-card">
                  <button class="toggle-row card-toggle-head" data-action="toggle-mcp" type="button" role="switch" aria-checked="true" id="sw-mcp">
                    <span class="toggle-label-wrap">
                      <svg class="section-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                      </svg>
                      <span class="toggle-label" data-i18n="menu.section_mcp">AI 与 MCP 扩展</span>
                    </span>
                    <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
                  </button>
                  <div class="collapsible-body" id="mcp-card-body">
                    <div class="mcp-copy-row">
                      <button class="mcp-copy-btn" data-action="copy-mcp" id="btn-copy-mcp" type="button">
                        <span id="mcp-copy-hint" data-i18n="menu.copy_mcp">复制 MCP 配置</span>
                      </button>
                      <button class="mcp-copy-btn" data-action="copy-hooks" id="btn-copy-hooks" type="button">
                        <span id="hooks-copy-hint" data-i18n="menu.copy_hooks">发给 AI 自动配置</span>
                      </button>
                    </div>
                  </div>
                </section>

                <section class="menu-card collapsible-card" id="obs-card">
                  <button class="toggle-row card-toggle-head" data-action="toggle-obs" type="button" role="switch" aria-checked="false" id="sw-obs">
                    <span class="toggle-label-wrap">
                      <svg class="section-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="9"></circle>
                        <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
                      </svg>
                      <span class="toggle-label" data-i18n="menu.section_obs">OBS 透明直播源</span>
                      <span class="port-pill hidden" id="obs-port-pill">:27421</span>
                    </span>
                    <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
                  </button>
                  <div class="collapsible-body hidden" id="obs-card-body">
                    <button class="sub-action-btn obs-copy-full" data-action="copy-obs" id="btn-copy-obs" type="button">
                      <span data-i18n="menu.copy_obs_short">复制透明源地址</span>
                      <span class="menu-hint" id="obs-copy-hint" data-i18n="menu.obs_hint">免抠像</span>
                    </button>
                    <button class="toggle-row sub-toggle-row" data-action="toggle-obs-hide" type="button" role="switch" aria-checked="false" id="sw-obs-hide">
                      <span class="toggle-label" data-i18n="menu.obs_hide_pet">仅 OBS 显示（隐藏桌面猫）</span>
                      <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
                    </button>
                  </div>
                </section>

                <section class="menu-card collapsible-card" id="live-card">
                  <button class="toggle-row card-toggle-head" data-action="toggle-live-capture" type="button" role="switch" aria-checked="false" id="sw-live">
                    <span class="toggle-label-wrap">
                      <svg class="section-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="2" y="4" width="20" height="14" rx="2.5"></rect>
                        <path d="M8 20h8M12 18v2"></path>
                      </svg>
                      <span class="toggle-label" data-i18n="menu.section_live">直播伴侣捕获窗</span>
                    </span>
                    <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
                  </button>
                  <div class="collapsible-body hidden" id="live-card-body">
                    <div class="setting-row">
                      <span class="setting-label" data-i18n="menu.live_chroma_label">幕布颜色</span>
                      <div class="seg-control seg-3">
                        <button class="seg-btn active" data-livechroma="blue" type="button">
                          <span class="chroma-dot chroma-dot-blue" aria-hidden="true"></span>
                          <span data-i18n="menu.live_chroma_blue">蓝幕</span>
                        </button>
                        <button class="seg-btn" data-livechroma="green" type="button">
                          <span class="chroma-dot chroma-dot-green" aria-hidden="true"></span>
                          <span data-i18n="menu.live_chroma_green">绿幕</span>
                        </button>
                        <button class="seg-btn" data-livechroma="magenta" type="button">
                          <span class="chroma-dot chroma-dot-magenta" aria-hidden="true"></span>
                          <span data-i18n="menu.live_chroma_magenta">品红</span>
                        </button>
                      </div>
                    </div>
                    <button class="toggle-row sub-toggle-row" data-action="toggle-live-hide" type="button" role="switch" aria-checked="false" id="sw-live-hide">
                      <span class="toggle-label" data-i18n="menu.live_hide_pet">仅直播显示（隐藏桌面猫）</span>
                      <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
                    </button>
                    <div class="live-guide-hint" data-i18n="menu.live_guide_hint">窗口捕获选 DesktopPet Live → 开绿幕抠图</div>
                  </div>
                </section>
              </div>
            </div>
          </section>
        </div>
"""

I18N = {
    "zh-CN.json": {
        "sys_initial_edition": "初版 · v1.0.0",
        "sys_running": "运行中",
        "sys_group_basic": "基础",
        "sys_group_actions": "快捷操作",
        "sys_group_ext": "扩展功能",
    },
    "zh-TW.json": {
        "sys_initial_edition": "初版 · v1.0.0",
        "sys_running": "運作中",
        "sys_group_basic": "基礎",
        "sys_group_actions": "快捷操作",
        "sys_group_ext": "擴充功能",
    },
    "en-US.json": {
        "sys_initial_edition": "First edition · v1.0.0",
        "sys_running": "Running",
        "sys_group_basic": "Basics",
        "sys_group_actions": "Quick actions",
        "sys_group_ext": "Extensions",
    },
    "ja-JP.json": {
        "sys_initial_edition": "初版 · v1.0.0",
        "sys_running": "稼働中",
        "sys_group_basic": "基本",
        "sys_group_actions": "クイック操作",
        "sys_group_ext": "拡張機能",
    },
    "ko-KR.json": {
        "sys_initial_edition": "초판 · v1.0.0",
        "sys_running": "실행 중",
        "sys_group_basic": "기본",
        "sys_group_actions": "빠른 작업",
        "sys_group_ext": "확장 기능",
    },
}


def rewrite_menu():
    p = ROOT / "menu.html"
    with p.open("r", encoding="utf-8", newline="") as f:
        raw = f.read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    start = raw.index("        <!-- Tab 3: System, AI/MCP & OBS -->")
    end_marker = "      </div>" + nl + nl + "      <!-- Fixed Bottom Footer -->"
    end = raw.index(end_marker, start)
    block = NEW_SYS_TAB.replace("\n", nl)
    new_raw = raw[:start] + block + raw[end:]
    with p.open("w", encoding="utf-8", newline="") as f:
        f.write(new_raw)
    print("menu.html: system tab rewritten (%d -> %d chars)" % (end - start, len(block)))


def add_i18n():
    for fn, keys in I18N.items():
        p = ROOT / "locales" / fn
        with p.open("r", encoding="utf-8", newline="") as f:
            raw = f.read()
        if '"sys_group_basic"' in raw:
            print("%s: keys already present, skipped" % fn)
            continue
        nl = "\r\n" if "\r\n" in raw else "\n"
        marker = '  "menu": {'
        idx = raw.index(marker) + len(marker)
        lines = ""
        for k, v in keys.items():
            v = v.replace("\\", "\\\\").replace('"', '\\"')
            lines += '%s    "%s": "%s",' % (nl, k, v)
        new_raw = raw[:idx] + lines + raw[idx:]
        with p.open("w", encoding="utf-8", newline="") as f:
            f.write(new_raw)
        print("%s: %d keys added" % (fn, len(keys)))


if __name__ == "__main__":
    rewrite_menu()
    add_i18n()
