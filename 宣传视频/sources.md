# DesktopPet 抖音宣传视频 · 素材来源

## 配音
- 口播稿：`script.json`（本人撰写）
- 合成：edge-tts `zh-CN-YunxiNeural`，rate +8%
- 字级时间戳：按逐句实测时长插值（edge-tts 中文不发 WordBoundary）

## 动物素材（真实 3D 渲染图）
- 来源：本项目 `KuroCat/_redraw3d/*.png`，由 Three.js 3D 引擎渲染（物种独立建模 + Blender 5.3 专属网格）
- 处理：`prepare_stills.py` 对背景色 `#e9e5de` 做色键去背，产出 `*-pet.png`（主体）与 `*-full.png`（含键盘场景）
- 使用：s01 奶龙 / s05 五只 / s06 六经典 / s07 六 IP / s08 草地牛 / s09 奶龙 / s10 奶龙 / s12 柴犬 / s16 五只

## 页面截图（真图证据）
- `pages/gh-repo.png` — https://github.com/daxian942-tech/DesktopPet （Playwright + 系统 Chrome 实拍，2026-11-27）
- `pages/gh-release.png` — https://github.com/daxian942-tech/DesktopPet/releases/tag/v1.0.2 （同上）
- 用于 s02 / s11 / s13

## 开源项目背景（口播事实来源）
- KuroCat：https://github.com/qianyiai/KuroCat （MIT License）
  - 定位：免费开源 3D/2D 透明置顶桌面打字小黑猫 & AI 编程伴侣
  - 技术栈：Rust + Tauri v2
  - 特性：打字互动、摸头呼噜、OBS 透明直播源、MCP 捏猫
- DesktopPet 为其二次开发版本：https://github.com/daxian942-tech/DesktopPet

## 音效
- 本片未使用第三方音效库采样；配音为唯一音轨。
