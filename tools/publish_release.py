#!/usr/bin/env python3
"""把本地 exe 发布到 DesktopPet 的 GitHub Release。

用法（token 只走环境变量 / git 凭证，不落盘、不进命令行历史）：
    GITHUB_TOKEN=ghp_xxx python tools/publish_release.py v1.0.3
    # 不设 token 时，自动读取 git credential（Windows 凭证管理器 / macOS Keychain）
    python tools/publish_release.py v1.0.3

流程：
  1. 若该 tag 的 Release 不存在则创建（target_commitish 固定为 main）
  2. 上传 DesktopPet-setup-<tag>.exe / DesktopPet-portable-<tag>.exe
     （同名 asset 已存在时先删除再上传，保证覆盖的是最新造型）
  3. 打印 releases/latest 实际返回的 tag，确认更新器读到的版本
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = "daxian942-tech/DesktopPet"
API = f"https://api.github.com/repos/{REPO}"
ROOT = Path(__file__).resolve().parent.parent
DELIVERY = ROOT / "交付产物"
TARGET_BRANCH = "main"


def api(path, method="GET", token=None, payload=None, data=None, content_type=None):
    url = path if path.startswith("http") else f"{API}{path}"
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "DesktopPet-release-script",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        content_type = "application/json"
    if content_type:
        headers["Content-Type"] = content_type
    last_err = None
    for attempt in range(4):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body) if body else None
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")[:600]
            raise RuntimeError(f"HTTP {e.code} {method} {url}\n{detail}") from e
        except (urllib.error.URLError, OSError) as e:
            last_err = e
            print(f"  [network retry {attempt + 1}/4] {e}")
    raise RuntimeError(f"网络请求反复失败（已重试 4 次）: {method} {url}\n{last_err}")


def resolve_token():
    """优先用环境变量；没有则从 git credential helper 取，避免 token 落盘。"""
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if token:
        return token
    try:
        out = subprocess.run(
            ["git", "credential", "fill"],
            input="protocol=https\nhost=github.com\n\n",
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        for line in out.stdout.splitlines():
            if line.startswith("password="):
                return line[len("password="):].strip()
    except Exception:
        pass
    return ""


def release_body(tag):
    return f"""## DesktopPet {tag} — 2D/3D 全面统一 + 人宠交互版

基于 v1.0.2 之后的所有改动：造型、质感、动作、交互与更新链路整体升级。

### 造型与渲染

- **2D 全面重做**：13 个物种统一为纯色 Q 版团子（大圆头 / 小圆身 / 短粗腿 / 大亮眼），
  新增 `src/chibi2d.ts` 统一绘制原语，与 3D 视觉语言对齐。
- **软陶质感回归**：非猫动物改用 `plushMaterial()` 柔和双光 shader，
  光照方向与猫咪 `FurShaderSystem` 一致，但更亮、无黑边，暗部补暖色层次。
- **淡淡同色系收边**：2D 用底层大椭圆 + 上层本色椭圆；3D 用 BackSide 轮廓壳
  （同色压暗 12%、放大 1.035 倍），不再有粗黑描边。
- **奶龙按参考图重做**：宽圆正头 + 亮黄头 / 橙身体 + 白眼圈墨绿大眼 +
  粉白大肚皮 + 短粗抱胸臂 + 灰褐脚趾。
- **打字手伸缩**：待机收手（奶龙抱胸），打字时才伸到键帽上，停手 0.5s 柔和收回；
  身体与头保持静止，不再整只抽搐。

### 人宠交互（猫和非猫都生效）

- **亲密度养成**：6 级关系、按 IP 差异化台词、本地持久化。
- **环境感知**：早晚问候、深夜催睡、断网恢复、低电量提醒、专注免打扰。
- **主动搭话**：按亲密度概率主动找话题。
- **输入语义理解**：打字节奏 / 关键词反应，**默认关闭**，密码框自动跳过。

### 稳定性

- **头顶照顾快捷栏小窗口自适应**：20%~100% 缩放三态布局
  （micro 2×2 / compact / normal），resize 后重算 Rust hit-test bounds，缩小时按钮不再被遮挡。
- **检查更新 403 降级**：GitHub REST API 被限流 / 代理拦截时，自动改用公开
  `releases.atom` 订阅源；降级结果不自动下载、不自动安装，底部按钮变为「↗ 打开发布页」。

### 下载

- `DesktopPet-setup-{tag}.exe` — NSIS 安装版（推荐）
- `DesktopPet-portable-{tag}.exe` — 免安装便携版

从 v1.0.2 及更早版本升级：点菜单底部「检查更新」即可自动升级；
安装包会校验 GitHub 提供的 SHA-256 后再安装。源码与构建方法见仓库 README。
"""


def main():
    token = resolve_token()
    if not token:
        sys.exit(
            "ERROR: 未找到 GitHub token。请设置 GITHUB_TOKEN（PAT 需要 repo 权限），"
            "或确保 git credential 中存有 github.com 凭证"
        )

    if len(sys.argv) < 2:
        sys.exit("用法: python tools/publish_release.py v1.0.3")
    tag = sys.argv[1].strip()
    assert tag.startswith("v") and tag.count(".") == 2, f"非法 tag: {tag}"

    setup = DELIVERY / "DesktopPet-安装包.exe"
    portable = DELIVERY / "DesktopPet-绿色版.exe"
    for p in (setup, portable):
        if not p.exists():
            sys.exit(f"缺少交付文件: {p}")

    # 1. 找或建 Release（target_commitish 必须是远端真实存在的分支）
    try:
        rel = api(f"/releases/tags/{tag}", token=token)
        print(f"Release {tag} 已存在，id={rel['id']}")
    except RuntimeError as e:
        if "HTTP 404" not in str(e):
            raise
        rel = api(
            "/releases",
            method="POST",
            token=token,
            payload={
                "tag_name": tag,
                "target_commitish": TARGET_BRANCH,
                "name": f"DesktopPet {tag}",
                "body": release_body(tag),
                "draft": False,
                "prerelease": False,
            },
        )
        print(f"Release {tag} 已创建，id={rel['id']}")

    # 2. 上传两个附件（同名先删后传，确保是最新 exe）
    for src, name in (
        (setup, f"DesktopPet-setup-{tag}.exe"),
        (portable, f"DesktopPet-portable-{tag}.exe"),
    ):
        for asset in rel.get("assets", []):
            if asset["name"] == name:
                print(f"删除旧 asset {name} ...")
                api(f"/releases/assets/{asset['id']}", method="DELETE", token=token)
        data = src.read_bytes()
        print(f"上传 {name} ({len(data)} bytes) ...")
        asset = api(
            f"{rel['upload_url'].split('{')[0]}?name={name}",
            method="POST",
            token=token,
            data=data,
            content_type="application/octet-stream",
        )
        print(f"  完成: {asset['name']}  digest={asset.get('digest')}")

    # 3. 核对更新器实际读取的接口
    latest = api("/releases/latest", token=token)
    print(f"\nreleases/latest 返回: {latest['tag_name']}")
    if latest["tag_name"] != tag:
        print(f"⚠ 警告: 期望 {tag}，实际 {latest['tag_name']}——检查是否为 prerelease/draft")
    else:
        print("✓ 更新器将读到新版本")
    print(f"✓ 发布页: https://github.com/{REPO}/releases/tag/{tag}")


if __name__ == "__main__":
    main()
