#!/usr/bin/env python3
"""离屏复现 creatureVoice.ts 的声学参数，生成动物叫声试听集 WAV。

用途：在不启动桌宠的情况下验收每种动物的叫声是否可辨、非静音。
参数与 src/creatureVoice.ts 的 VOICES 表保持一致（改参数请同步两边）。
"""
import math
import struct
import wave
from pathlib import Path

import numpy as np

SR = 44100

# species: (f0, f1, dur, wave, cutoff, gain, vibHz, vibDepth, breath, repeat, gap)
V = {
    '猫': (620, 460, 0.42, 'sine', 1500, .10, 5, .02, .10, 1, 0),
    '柴犬': (520, 170, 0.20, 'triangle', 900, .14, 0, 0, .28, 2, .16),
    '狐狸': (900, 1450, 0.26, 'sawtooth', 2600, .075, 12, .04, .16, 1, 0),
    '熊猫': (250, 175, 0.55, 'triangle', 700, .12, 4, .03, .30, 1, 0),
    '兔子': (1150, 1500, 0.13, 'sine', 3200, .065, 0, 0, .08, 2, .10),
    '企鹅': (340, 280, 0.15, 'square', 1100, .085, 0, 0, .14, 3, .13),
    '青蛙': (190, 150, 0.30, 'sawtooth', 620, .13, 26, .10, .20, 2, .18),
    '吉伊卡哇': (1400, 1900, 0.11, 'sine', 3800, .055, 18, .05, .06, 2, .09),
    '草地牛': (155, 92, 0.95, 'sawtooth', 480, .16, 6, .06, .34, 1, 0),
    '奶龙': (430, 640, 0.58, 'sine', 1800, .12, 7, .05, .12, 1, 0),
    '水豚噜噜': (210, 165, 0.40, 'triangle', 560, .11, 5, .03, .22, 1, 0),
    '露比': (780, 1050, 0.30, 'sine', 2200, .085, 9, .04, .10, 1, 0),
    '布布': (330, 240, 0.38, 'triangle', 780, .10, 11, .07, .42, 1, 0),
}


def synth(f0, f1, dur, wave, cutoff, gain, vib, vibd, breath):
    n = int(SR * dur)
    t = np.arange(n) / SR
    # 音高包络 f0 -> f1 -> f0*0.82
    bend = 0.5
    f = np.where(t < dur * bend,
                 f0 + (f1 - f0) * (t / (dur * bend)),
                 f1 + (f0 * .82 - f1) * ((t - dur * bend) / (dur * (1 - bend))))
    if vib > 0:
        f = f * (1 + vibd * np.sin(2 * np.pi * vib * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    if wave == 'sine':
        s = np.sin(ph)
    elif wave == 'triangle':
        s = 2 / np.pi * np.arcsin(np.sin(ph))
    elif wave == 'sawtooth':
        s = 2 * (ph / (2 * np.pi) % 1) - 1
    else:  # square
        s = np.sign(np.sin(ph))
    # 简易低通（一阶）
    a = math.exp(-2 * math.pi * cutoff / SR)
    lp = np.zeros(n)
    for i in range(1, n):
        lp[i] = a * lp[i - 1] + (1 - a) * s[i]
    s = lp
    # 气声
    if breath > .04:
        noise = np.random.uniform(-1, 1, n) * (1 - t / dur)
        s = s * (1 - breath) + noise * breath
    # 包络
    atk = max(.008, dur * .18)
    env = np.minimum(1, t / atk) * np.exp(-t / (dur * .45))
    env = np.clip(env, 0, 1)
    return (s * env * gain).astype(np.float32)


def synth_purr(f0, cutoff, big):
    """抚摸满足声：低频三角波 + 22/28Hz 振幅颤动，模拟喉音咕噜。"""
    dur = 0.85
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = max(42, f0 * (0.30 if big else 0.42))
    ph = 2 * np.pi * np.cumsum(np.full(n, f)) / SR
    s = 2 / np.pi * np.arcsin(np.sin(ph))
    a = math.exp(-2 * math.pi * max(320, cutoff * 0.55) / SR)
    lp = np.zeros(n)
    for i in range(1, n):
        lp[i] = a * lp[i - 1] + (1 - a) * s[i]
    trem = 0.55 + 0.45 * np.sin(2 * np.pi * (22 if big else 28) * t)
    env = np.minimum(1, t / 0.14) * np.exp(-np.maximum(0, t - (dur - 0.18)) / 0.12)
    return (lp * trem * env * 0.075).astype(np.float32)


def synth_touch(f0, cutoff, gain, kind):
    """被戳（boop，上扬）/ 甩尾（flick，下滑）。"""
    dur = 0.12 if kind == 'boop' else 0.10
    n = int(SR * dur)
    t = np.arange(n) / SR
    base = f0 * (1.0 if kind == 'boop' else 1.25)
    end = base * (1.55 if kind == 'boop' else 0.55)
    f = base + (end - base) * (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) if kind == 'boop' else 2 / np.pi * np.arcsin(np.sin(ph))
    env = np.minimum(1, t / 0.012) * np.exp(-t / (dur * 0.35))
    return (s * env * gain * (0.85 if kind == 'boop' else 0.6)).astype(np.float32)


def main():
    root = Path(__file__).resolve().parent.parent / '交付产物'
    gap = np.zeros(int(SR * .45), dtype=np.float32)
    chunks = []
    for name, p in V.items():
        f0, f1, dur, wavetype, cutoff, gain, vib, vibd, breath, repeat, rgap = p
        one = synth(f0, f1, dur, wavetype, cutoff, gain, vib, vibd, breath)
        call = one.copy()
        for i in range(1, repeat):
            call = np.concatenate([call, np.zeros(int(SR * rgap), dtype=np.float32), one])
        chunks.append(call)
        chunks.append(gap)
    audio = np.concatenate(chunks)
    audio = np.clip(audio, -.95, .95)
    pcm = b''.join(struct.pack('<h', int(x * 32767)) for x in audio)
    out = root / '动物叫声试听集.wav'
    with wave.open(str(out), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm)
    print(f'生成 {out}  {len(audio)/SR:.1f}s')

    # 交互音试听：每种动物「抚摸 → 被戳 → 甩尾」三连
    bigs = {'草地牛', '水豚噜噜', '熊猫'}
    big_gap = np.zeros(int(SR * .28), dtype=np.float32)
    touch_chunks = []
    for name, p in V.items():
        f0, _f1, _dur, _w, cutoff, gain, *_ = p
        touch_chunks.append(synth_purr(f0, cutoff, name in bigs))
        touch_chunks.append(np.zeros(int(SR * .18), dtype=np.float32))
        touch_chunks.append(synth_touch(f0, cutoff, gain, 'boop'))
        touch_chunks.append(np.zeros(int(SR * .18), dtype=np.float32))
        touch_chunks.append(synth_touch(f0, cutoff, gain, 'flick'))
        touch_chunks.append(big_gap)
    ta = np.clip(np.concatenate(touch_chunks), -.95, .95)
    pcm2 = b''.join(struct.pack('<h', int(x * 32767)) for x in ta)
    out2 = root / '动物交互音试听集.wav'
    with wave.open(str(out2), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm2)
    print(f'生成 {out2}  {len(ta)/SR:.1f}s（每种动物：抚摸→被戳→甩尾）')


if __name__ == '__main__':
    main()
