#!/usr/bin/env python3
"""精确下载指定的 Wikimedia Commons 动物叫声文件（比模糊搜索可靠）。

每个物种给定候选文件名（英文/德文原名），逐个尝试直到成功。
下载后做频谱校验：主频落在该物种合理区间才采用。
"""
import base64
import json
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "animal-voices"
FFMPEG = r"C:/Users/23248/.workbuddy/binaries/ffmpeg-bin/ffmpeg.exe"
FFPROBE = FFMPEG.replace("ffmpeg.exe", "ffprobe.exe")
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
UA = {"User-Agent": "DesktopPet/1.0 (animal voice asset research)"}

# 物种 -> (候选文件名列表, 合理主频下限, 上限)。None 表示跳过频谱校验。
TARGETS = {
    "grasscow": (["File:Mudchute cow 1.ogg", "File:Boerlaedje vatches.ogg"], 60, 900),
    "dog": (["File:Barking of a dog.ogg", "File:Dog barking.webm"], 150, 2200),
    "cat": (["File:Meow domestic cat.ogg", "File:Audio file of cat meowing.ogg"], 300, 2500),
    "fox": (["File:Bellender Fuchs.ogg", "File:FuchsSchreit.mp3"], 150, 2500),
    "frog": (["File:Single Frog Croak.oga", "File:Frog croaking after rain, Kerala.wav"], 80, 2500),
    "penguin": (["File:20091121 Little Penguin calls at St Kilda Breakwater.ogg"], 150, 3000),
    "panda": (["File:Red panda twittering.ogg"], 200, 3000),
}


def api(params):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
        return json.loads(r.read().decode("utf-8"))


def get_url(title):
    d = api({"action": "query", "format": "json", "titles": title,
             "prop": "imageinfo", "iiprop": "url|size"})
    for p in d.get("query", {}).get("pages", {}).values():
        info = p.get("imageinfo")
        if info:
            return info[0]["url"], info[0].get("size", 0)
    return None


def download(url, dest):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
        dest.write_bytes(r.read())
    return dest.stat().st_size > 1024


def clip(src, dst):
    try:
        d = float(subprocess.check_output(
            [FFPROBE, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(src)]).decode().strip() or 0)
    except Exception:
        d = 0
    start = max(0.0, min(0.5, d * 0.1))
    span = min(2.4, max(0.7, d - start))
    r = subprocess.run([
        FFMPEG, "-y", "-ss", f"{start:.2f}", "-t", f"{span:.2f}", "-i", str(src),
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=9,silenceremove=start_periods=1:start_threshold=-45dB",
        "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "112k", str(dst),
    ], capture_output=True)
    return r.returncode == 0 and dst.exists() and dst.stat().st_size > 2048


def peak_freq(mp3):
    """返回主频（Hz）；解码失败返回 0。"""
    try:
        raw = subprocess.run(
            [FFMPEG, "-i", str(mp3), "-f", "f32le", "-ac", "1", "-ar", "22050", "-"],
            capture_output=True).stdout
        import numpy as np
        a = np.frombuffer(raw, dtype=np.float32)
        if len(a) < 1024:
            return 0
        sp = np.abs(np.fft.rfft(a * np.hanning(len(a))))
        fr = np.fft.rfftfreq(len(a), 1 / 22050)
        m = fr > 60
        return float(fr[m][np.argmax(sp[m])])
    except Exception:
        return 0


def main():
    embed = "--embed" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    got = {}
    for sp, (titles, lo, hi) in TARGETS.items():
        dst = OUT / f"{sp}.mp3"
        if dst.exists() and dst.stat().st_size > 4096:
            f = peak_freq(dst)
            if lo <= f <= hi:
                print(f"[ok] {sp}: {f:.0f}Hz")
                got[sp] = dst
                continue
            print(f"[重下] {sp}: 已有 {f:.0f}Hz 不在 {lo}-{hi}")
            dst.unlink()
        for title in titles:
            try:
                info = get_url(title)
                if not info:
                    print(f"  {title[:45]} 无 URL")
                    continue
                url, size = info
                if size > 15_000_000:
                    continue
                tmp = OUT / ("_tmp_" + sp + (Path(url).suffix or ".ogg"))
                print(f"  下载 {title[:45]} ({size//1024}KB)")
                if not download(url, tmp):
                    continue
                if not clip(tmp, dst):
                    tmp.unlink(missing_ok=True)
                    continue
                tmp.unlink(missing_ok=True)
                f = peak_freq(dst)
                if lo <= f <= hi:
                    print(f"  ✓ {sp} 采用 {title[:40]}  主频 {f:.0f}Hz")
                    got[sp] = dst
                    break
                print(f"  ✗ {sp} 主频 {f:.0f}Hz 不在 {lo}-{hi}，换下一个")
                dst.unlink()
            except Exception as e:
                print(f"  {title[:40]} 失败 {str(e)[:50]}")
    print(f"\n成功 {len(got)}/{len(TARGETS)}: {sorted(got)}")

    if embed and got:
        lines = [
            "// 真实动物叫声（Wikimedia Commons，CC 授权）。由 tools/fetch_animal_sounds.py 生成。",
            "// 键为物种 id；未收录的物种回退到程序化合成。",
            "export const ANIMAL_VOICE_MP3_B64: Record<string, string> = {",
        ]
        for sp, p in sorted(got.items()):
            lines.append(f"  {sp}: '{base64.b64encode(p.read_bytes()).decode()}',")
        lines.append("};")
        out = ROOT / "src" / "animalVoiceData.ts"
        out.write_text("\n".join(lines), encoding="utf-8")
        print(f"生成 {out}  {out.stat().st_size//1024}KB")


if __name__ == "__main__":
    main()
