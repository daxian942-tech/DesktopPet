#!/usr/bin/env python3
"""把本地 exe 发布到 DesktopPet 的 GitHub Release。

用法（token 只走环境变量，不落盘、不进命令行历史）：
    GITHUB_TOKEN=ghp_xxx python tools/publish_release.py v1.0.2

流程：
  1. 若该 tag 的 Release 不存在则创建
  2. 上传 DesktopPet-setup-<tag>.exe / DesktopPet-portable-<tag>.exe
     （同名 asset 已存在时先删除再上传，保证覆盖的是最新造型）
  3. 打印 releases/latest 实际返回的 tag，确认更新器读到的版本
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

REPO = "daxian942-tech/DesktopPet"
API = f"https://api.github.com/repos/{REPO}"
ROOT = Path(__file__).resolve().parent.parent
DELIVERY = ROOT / "交付产物"


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
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:600]
        raise RuntimeError(f"HTTP {e.code} {method} {url}\n{detail}") from e


def main():
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not token:
        sys.exit("ERROR: 请先设置环境变量 GITHUB_TOKEN（PAT 需要 repo 权限）")

    if len(sys.argv) < 2:
        sys.exit("用法: GITHUB_TOKEN=ghp_xxx python tools/publish_release.py v1.0.2")
    tag = sys.argv[1].strip()
    assert tag.startswith("v") and tag.count(".") == 2, f"非法 tag: {tag}"

    setup = DELIVERY / "DesktopPet-安装包.exe"
    portable = DELIVERY / "DesktopPet-绿色版.exe"
    for p in (setup, portable):
        if not p.exists():
            sys.exit(f"缺少交付文件: {p}")

    body = (
        f"## DesktopPet {tag} — Blender 5.3 造型升级版\n\n"
        "在 v1.0.1 基础上，用 Blender 5.3 为 5 只 IP 萌宠重做专属网格与动作。\n\n"
        "### 本次更新\n"
        "- **10 个 Blender 专属网格原型**：龙头 / 弹性肚腩 / 方圆牛头 / 草叶 / 迷你镰刀 / "
        "河狸尾 / 呆毛 / 蝴蝶结 / 纽扣眼 / 耷拉耳，形状全部来自 Blender，不再是通用球体拼参数\n"
        "- **奶龙**：超大圆脑袋 + Q 弹肚腩 + 亮绿大圆眼，肚腩 Duang / 喷小火苗\n"
        "- **草地牛**：方圆形脑袋 + 半闭呆滞眼 + 叼草叶，眨眼慢半拍 / 草叶掉下来 / 突然扭头\n"
        "- **吉伊卡哇**：米白团子 + 豆豆眼 + 手持迷你镰刀，缩肩抖 / 举镰刀愣住\n"
        "- **露比**：粉河狸 + 呆毛 + 兔牙 + 粉蝴蝶结 + 扁平河狸尾，捂脸偷看 / 尾巴抱怀里\n"
        "- **布布**：破布偶熊 + 一高一低纽扣眼 + 歪扭缝线嘴 + 耷拉耳，瘫倒 / 线头冒出\n"
        "- 水豚噜噜保持原有造型与动作\n\n"
        "### 下载\n"
        f"- `DesktopPet-setup-{tag}.exe` — NSIS 安装版（推荐）\n"
        f"- `DesktopPet-portable-{tag}.exe` — 免安装便携版\n\n"
        "从 v1.0.0 / v1.0.1 升级的用户：点菜单底部的「检查更新」即可自动升级到新造型。"
    )

    # 1. 找或建 Release
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
                "target_commitish": "desktoppet-main",
                "name": f"DesktopPet {tag}",
                "body": body,
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


if __name__ == "__main__":
    main()
