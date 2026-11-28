"""生成 60 秒抖音视频的中文旁白、极轻氛围垫音与逐句时间轴。

输出：
    _video_audio/narration.wav   纯旁白（24000Hz 单声道）
    _video_audio/soundtrack.wav  旁白 + 轻垫音，60 秒
    _video_audio/timing.json     每句 start / end，供合成脚本显示字幕与切镜头
"""
from pathlib import Path
import asyncio, json, subprocess
import numpy as np
import edge_tts

ROOT = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
OUT = ROOT / "_video_audio"
OUT.mkdir(exist_ok=True)
FFMPEG = r"C:/Users/23248/.workbuddy/binaries/ffmpeg-full/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe"

VOICE = "zh-CN-XiaoxiaoNeural"
RATE = "-4%"
ATEMPO = 1.10          # 不变调提速：把 64.2s 旁白压进 60s
TOTAL = 60.0
LEAD_IN = 0.9          # 片头留白
GAP = 0.36             # 句间停顿
SR = 24000

SENTS = [
    "你家电脑桌面上那只猫，最近偷偷学了几个新本事，每一个都让你忍不住多戳它两下。",
    "先说跳跃。按住它往下拖，它会乖乖压扁身子蓄力，拖得越远、按得越久，攒的劲就越大。",
    "一松手，蹦！整个人弹到半空，键盘还稳稳留在桌上，落地再软软地回弹一下。",
    "点一下它，头顶浮出四个圆按钮，喂食有专属的碗，玩耍还会弹出两颗跳跳球。",
    "喝水也换了新道具，蓝色水碗里一圈圈波纹荡开，还有淡淡的蓝色小水泡。",
    "洗澡最热闹，脚下一滩水，水滴往下落，白色肥皂泡慢悠悠往上飘。",
    "最关键的是，这些不只有猫，十二只动物、二维和三维两种模式全都同步更新，项目免费开源，链接我放评论区了。",
]


async def tts_all():
    for i, text in enumerate(SENTS):
        dest = OUT / f"seg{i:02d}.mp3"
        if dest.exists() and dest.stat().st_size > 1000:
            print(f"[tts] {i:02d} cached")
            continue
        print(f"[tts] {i:02d}: {text}")
        await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(dest))


def wav_of_mp3(p: Path) -> np.ndarray:
    wav = OUT / (p.stem + ".wav")
    subprocess.run([FFMPEG, "-y", "-v", "error", "-i", str(p),
                    "-af", f"atempo={ATEMPO}",
                    "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", str(wav)],
                   check=True, capture_output=True)
    raw = wav.read_bytes()
    # 跳过 WAV 头，直接取 data 段
    idx = raw.find(b"data")
    data = raw[idx + 8:]
    return np.frombuffer(data, dtype="<i2").astype(np.float32) / 32768.0


def build_pad(duration: float) -> np.ndarray:
    """极轻的柔和和弦垫音，避免纯旁白听起来太空，音量压到几乎只是底噪。"""
    n = int(duration * SR)
    t = np.arange(n, dtype=np.float32) / SR
    out = np.zeros(n, dtype=np.float32)
    # A 大三和弦，缓慢轮换的三个和弦
    chords = [(220.0, 277.18, 329.63), (196.0, 246.94, 293.66), (174.61, 220.0, 261.63)]
    bar = 4.0
    for k, freqs in enumerate(chords):
        for f in freqs:
            # 基频 + 二次泛音，加极缓的音量呼吸
            tone = np.sin(2 * np.pi * f * t) + 0.28 * np.sin(2 * np.pi * f * 2 * t)
            env = np.zeros(n, dtype=np.float32)
            for start in np.arange(k * bar, duration, bar * len(chords)):
                a, b = int(start * SR), int(min(duration, start + bar) * SR)
                if b <= a:
                    continue
                ln = b - a
                shape = np.minimum(1.0, np.arange(ln) / (0.25 * SR))
                shape *= np.minimum(1.0, (ln - np.arange(ln)) / (0.6 * SR))
                env[a:b] = np.maximum(env[a:b], shape)
            out += tone * env
    out /= max(1e-6, np.max(np.abs(out)))
    # 全局淡入淡出 + 低音量
    fade = int(1.5 * SR)
    out[:fade] *= np.linspace(0, 1, fade)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out * 0.055


def main():
    asyncio.run(tts_all())

    clips = [wav_of_mp3(OUT / f"seg{i:02d}.mp3") for i in range(len(SENTS))]
    sr_gap = np.zeros(int(GAP * SR), dtype=np.float32)
    sr_lead = np.zeros(int(LEAD_IN * SR), dtype=np.float32)

    narr = sr_lead.copy()
    segments = []
    for i, clip in enumerate(clips):
        start = len(narr) / SR
        narr = np.concatenate([narr, clip])
        end = len(narr) / SR
        segments.append({"i": i, "text": SENTS[i], "start": round(start, 3),
                         "end": round(end, 3), "dur": round(end - start, 3)})
        if i < len(clips) - 1:
            narr = np.concatenate([narr, sr_gap])

    spoken_end = len(narr) / SR
    print(f"旁白总长 {spoken_end:.2f}s / 目标 {TOTAL}s")
    if spoken_end > TOTAL:
        raise RuntimeError(f"旁白超时 {spoken_end:.2f}s，请精简文案或调快语速")

    # 补尾部静音到 60 秒
    narr = np.concatenate([narr, np.zeros(int((TOTAL - spoken_end) * SR), dtype=np.float32)])
    narr = narr[: int(TOTAL * SR)]

    pad = build_pad(TOTAL)[: len(narr)]
    mix = np.clip(narr * 0.95 + pad, -1.0, 1.0)

    def write_wav(path: Path, x: np.ndarray):
        pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
        header = b"RIFF" + (36 + len(pcm) * 2).to_bytes(4, "little") + b"WAVEfmt "
        header += (16).to_bytes(4, "little") + (1).to_bytes(2, "little")
        header += (1).to_bytes(2, "little") + SR.to_bytes(4, "little")
        header += (SR * 2).to_bytes(4, "little") + (2).to_bytes(2, "little")
        header += (16).to_bytes(2, "little") + b"data" + (len(pcm) * 2).to_bytes(4, "little")
        path.write_bytes(header + pcm.tobytes())

    write_wav(OUT / "narration.wav", narr)
    write_wav(OUT / "soundtrack.wav", mix)
    (OUT / "timing.json").write_text(
        json.dumps({"totalSec": TOTAL, "fps": 30, "segments": segments},
                   ensure_ascii=False, indent=2), encoding="utf-8")
    print("saved narration.wav / soundtrack.wav / timing.json")
    for s in segments:
        print(f"  {s['i']} {s['start']:6.2f} - {s['end']:6.2f}  {s['text'][:18]}…")


if __name__ == "__main__":
    main()
