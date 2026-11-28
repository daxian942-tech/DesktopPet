#!/usr/bin/env python3
"""git push 通道被代理阻断时的兜底：用 GitHub Git Data API 复刻一个本地 commit。

用法: python tools/github_api_push.py [commit_sha] [branch]
      不传 commit 默认 HEAD，不传 branch 默认 main；先本地 git commit，再运行本脚本复刻到远端。
token 从 GITHUB_TOKEN 或 git credential helper 读取，绝不打印。
"""
import base64
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

REPO = "daxian942-tech/DesktopPet"
API = f"https://api.github.com/repos/{REPO}"


def git_bytes(*args):
    # core.quotepath=false：中文路径不要转义成 \345\212\250 形式，否则 cat-file 找不到对象
    return subprocess.run(
        ["git", "-c", "core.quotepath=false", *args], capture_output=True, check=True
    ).stdout


def git(*args):
    return git_bytes(*args).decode("utf-8").strip()


def resolve_token():
    t = os.environ.get("GITHUB_TOKEN", "").strip()
    if t:
        return t
    out = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        capture_output=True, text=True, check=False, timeout=20,
    )
    for line in out.stdout.splitlines():
        if line.startswith("password="):
            return line[len("password="):].strip()
    raise SystemExit("ERROR: 找不到 GitHub token")


TOKEN = resolve_token()


def api(path, method="GET", payload=None):
    url = path if path.startswith("http") else API + path
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "DesktopPet-api-push",
        "Authorization": f"Bearer {TOKEN}",
    }
    if data:
        headers["Content-Type"] = "application/json"
    last_err = None
    for attempt in range(4):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body) if body else None
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")[:800]
            raise RuntimeError(f"HTTP {e.code} {method} {url}\n{detail}") from e
        except (urllib.error.URLError, OSError) as e:
            last_err = e
            print(f"  [network retry {attempt + 1}/4] {e}")
    raise RuntimeError(f"网络请求反复失败（已重试 4 次）: {method} {url}\n{last_err}")


def iso_from_git(raw):
    m = re.match(r"^(.*) <(.*)> (\d+) ([+-]\d{4})$", raw)
    if not m:
        raise RuntimeError(f"无法解析 git 身份行: {raw!r}")
    name, email, ts, tz = m.group(1), m.group(2), int(m.group(3)), m.group(4)
    sign = 1 if tz[0] == "+" else -1
    offset = timedelta(minutes=sign * (int(tz[1:3]) * 60 + int(tz[3:5])))
    dt = datetime.fromtimestamp(ts, tz=timezone(offset))
    return {"name": name, "email": email, "date": dt.isoformat()}


def main():
    # 规范化成完整 SHA，避免拿 7 位缩写去和 API 返回的完整 SHA 比较而误报「不一致」
    commit = git("rev-parse", sys.argv[1] if len(sys.argv) > 1 else "HEAD")
    branch = sys.argv[2] if len(sys.argv) > 2 else "main"
    raw = git_bytes("cat-file", "commit", commit)
    head, message = raw.split(b"\n\n", 1)
    headers = {}
    for line in head.split(b"\n"):
        k, v = line.split(b" ", 1)
        headers.setdefault(k.decode(), []).append(v.decode())
    tree_local = headers["tree"][0]
    parents = headers.get("parent", [])
    if len(parents) != 1:
        raise SystemExit(f"只支持单父提交，实际 {len(parents)} 个")
    parent = parents[0]
    parent_tree = git("rev-parse", f"{parent}^{{tree}}")

    print(f"本地 commit : {commit}")
    print(f"父提交      : {parent}")
    print(f"本地 tree   : {tree_local}")
    print(f"message     : {message.decode('utf-8').strip()[:70]}")

    # 远端当前 ref，确保是 fast-forward
    ref = api(f"/git/ref/heads/{branch}")
    if ref["object"]["sha"] != parent:
        raise SystemExit(
            f"远端 {branch} = {ref['object']['sha']}，不是期望的父提交 {parent}，停止以免覆盖"
        )
    print(f"远端 {branch}    : {ref['object']['sha']} (fast-forward OK)")

    # 变更文件（含 mode / blob sha）
    changed = [l for l in git("diff-tree", "-r", "--no-commit-id", "--name-status", parent, commit).splitlines() if l]
    entries = {}
    for line in git("ls-tree", "-r", commit).splitlines():
        meta, path = line.split("\t", 1)
        mode, typ, sha = meta.split()
        entries[path] = (mode, sha)
    paths = []
    for line in changed:
        parts = line.split("\t")
        status, path = parts[0], parts[-1]
        if status.startswith("D"):
            paths.append((path, None))
        else:
            if path not in entries:
                raise SystemExit(f"变更文件 {path} 不在 tree 中")
            paths.append((path, entries[path]))
    print(f"变更文件    : {len(paths)} 个")

    tree_items = []
    for path, meta in paths:
        if meta is None:
            tree_items.append({"path": path, "mode": "100644", "type": "blob", "sha": None})
            print(f"  D {path}")
            continue
        mode, local_blob = meta
        content = git_bytes("cat-file", "blob", f"{commit}:{path}")
        note = "already on remote"
        try:
            api(f"/git/blobs/{local_blob}")
        except RuntimeError as e:
            if "HTTP 404" not in str(e):
                raise
            blob = api("/git/blobs", "POST", {
                "content": base64.b64encode(content).decode("ascii"),
                "encoding": "base64",
            })
            if blob["sha"] != local_blob:
                raise SystemExit(f"blob SHA 不一致 {path}: 本地 {local_blob} / 远端 {blob['sha']}")
            note = "uploaded"
        tree_items.append({"path": path, "mode": mode, "type": "blob", "sha": local_blob})
        print(f"  M {path} ({mode}, {len(content)} bytes, blob {local_blob[:8]}, {note})")

    new_tree = api("/git/trees", "POST", {"base_tree": parent_tree, "tree": tree_items})
    print(f"远端 tree   : {new_tree['sha']}")
    if new_tree["sha"] != tree_local:
        print("⚠ tree SHA 与本地不一致（内容仍应相同），继续用远端 tree 创建 commit")

    new_commit = api("/git/commits", "POST", {
        "message": message.decode("utf-8"),
        "tree": new_tree["sha"],
        "parents": [parent],
        "author": iso_from_git(headers["author"][0]),
        "committer": iso_from_git(headers["committer"][0]),
    })
    print(f"远端 commit : {new_commit['sha']}")
    if new_commit["sha"] == commit:
        print("✓ commit SHA 与本地完全一致，远端与本地无分叉")
    else:
        print("⚠ commit SHA 与本地不同（GitHub 重新序列化了提交），内容一致但需后续对齐本地分支")

    updated = api(f"/git/refs/heads/{branch}", "PATCH", {"sha": new_commit["sha"], "force": False})
    print(f"✓ 远端 {branch} 已更新为 {updated['object']['sha']}")


if __name__ == "__main__":
    main()
