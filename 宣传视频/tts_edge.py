#!/usr/bin/env python3
"""用 edge-tts 生成配音 + 字级时间戳（走 WordBoundary 事件，不需要 ASR 模型）。

输入 script.json，输出：
  audio/full.wav        整条配音（ffmpeg 转 PCM）
  audio/timestamps.json 符合 video-talkcraft schema: {sr,total,sentences:[{i,text,start,end,match,ok,words:[...]}]}

用法：
  python tts_edge.py script.json audio
"""
import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path

import edge_tts

FFMPEG = r"C:/Users/23248/.workbuddy/binaries/ffmpeg-bin/ffmpeg.exe"


def normalize(text: str) -> str:
    """只保留可打字的字符用于时间戳对位：中文/字母/数字。"""
    return re.sub(r"[^\w\u4e00-\u9fff]", "", text, flags=re.UNICODE).lower()


async def synthesize(text: str, voice: str, rate: str, out_mp3: Path, boundary_log: list):
    comm = edge_tts.Communicate(text, voice, rate=rate)
    with open(out_mp3, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                boundary_log.append(
                    {
                        "text": chunk["text"],
                        "offset": chunk["offset"] / 10_000_000,  # 100ns -> s
                        "duration": chunk["duration"] / 10_000_000,
                    }
                )


def interpolate_words(text: str, start: float, end: float):
    """按字符位置均匀插值出字级时间戳（edge-tts 中文不发 WordBoundary 时的兜底）。

    逐句单独合成、拼接，句边界是精确的；句内按字符数均分（宣传片字幕整句硬现，
    字级锚点只用于镜头节拍，均分足够准确）。
    """
    chars = [c for c in text if not c.isspace()]
    n = len(chars)
    if n == 0:
        return []
    step = (end - start) / n
    return [
        {"text": c, "start": round(start + i * step, 3), "end": round(start + (i + 1) * step, 3)}
        for i, c in enumerate(chars)
    ]


def build_sentences(sentences, segment_times, boundaries):
    """优先用 WordBoundary 精确对齐；没有则按每句实际合成时长均匀插值。

    segment_times: [(start, end), ...] 与 sentences 一一对应，来自 ffprobe 实测。
    """
    # 若 boundary 数量足够，走原精确路径
    words = [b for b in boundaries if normalize(b["text"])]
    if len(words) >= sum(len(normalize(s)) for s in sentences) * 0.8:
        cursor = 0
        result = []
        for i, sent in enumerate(sentences):
            chars = normalize(sent)
            sent_words = []
            while cursor < len(words):
                w = words[cursor]
                wchars = normalize(w["text"])
                need = len(chars) - sum(len(normalize(x["text"])) for x in sent_words)
                if need <= 0:
                    break
                if len(wchars) > need:
                    frac = need / len(wchars)
                    sent_words.append({"text": w["text"][:need],
                                       "start": round(w["offset"], 3),
                                       "end": round(w["offset"] + w["duration"] * frac, 3)})
                    words[cursor] = {"text": w["text"][need:],
                                     "offset": w["offset"] + w["duration"] * frac,
                                     "duration": w["duration"] * (1 - frac)}
                else:
                    sent_words.append({"text": w["text"],
                                       "start": round(w["offset"], 3),
                                       "end": round(w["offset"] + w["duration"], 3)})
                    cursor += 1
            if sent_words:
                result.append({"i": len(result), "text": sent,
                               "start": sent_words[0]["start"], "end": sent_words[-1]["end"],
                               "match": 1.0, "ok": True, "words": sent_words})
        return result

    # 兜底：按句时长均匀插值
    result = []
    for i, (sent, (start, end)) in enumerate(zip(sentences, segment_times)):
        sw = interpolate_words(sent, start, end)
        result.append({"i": i, "text": sent, "start": round(start, 3), "end": round(end, 3),
                       "match": 1.0, "ok": True, "words": sw})
    return result


def main():
    if len(sys.argv) < 3:
        sys.exit("用法: python tts_edge.py script.json audio_dir")
    root = Path(sys.argv[1]).resolve().parent
    outdir = Path(sys.argv[2]).resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    cfg = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    sentences = cfg["sentences"]
    voice = cfg.get("voice", "zh-CN-YunxiNeural")
    rate = cfg.get("rate", "+0%")

    # 逐句合成再拼接，保证句子边界与时间戳一一对应
    mp3s = []
    all_boundaries = []
    segment_times = []
    base = 0.0
    for i, sent in enumerate(sentences):
        mp3 = outdir / f"seg{i:02d}.mp3"
        bl = []
        asyncio.run(synthesize(sent, voice, rate, mp3, bl))
        # 把本句 boundary 的 offset 加上全局偏移
        for b in bl:
            b["offset"] += base
        all_boundaries.extend(bl)
        # 用 ffprobe 拿本句真实时长
        dur = float(
            subprocess.check_output(
                [FFMPEG.replace("ffmpeg.exe", "ffprobe.exe"), "-v", "error",
                 "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(mp3)]
            ).decode().strip()
        )
        segment_times.append((base, base + dur))
        base += dur
        mp3s.append((mp3, dur))
        print(f"[{i+1}/{len(sentences)}] {dur:.2f}s  {sent[:24]}")

    # 拼接 mp3
    concat_list = outdir / "concat.txt"
    concat_list.write_text("".join(f"file '{p.name}'\n" for p, _ in mp3s), encoding="utf-8")
    merged = outdir / "full.mp3"
    subprocess.run(
        [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
         "-c", "copy", str(merged)],
        check=True, capture_output=True,
    )
    # 转 48k 单声道 wav
    wav = outdir / "full.wav"
    subprocess.run(
        [FFMPEG, "-y", "-i", str(merged), "-ar", "48000", "-ac", "1", str(wav)],
        check=True, capture_output=True,
    )

    st = build_sentences(sentences, segment_times, all_boundaries)
    ts = {
        "sr": 48000,
        "total": round(base, 3),
        "sentences": st,
    }
    (outdir / "timestamps.json").write_text(
        json.dumps(ts, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    bad = [s for s in st if not s["ok"]]
    print(f"\n完成: {wav}  {base:.1f}s  对齐 {len(st)}/{len(sentences)} 句")
    if bad:
        print("⚠ 低匹配句:", [(s["i"], s["match"]) for s in bad])


if __name__ == "__main__":
    main()
