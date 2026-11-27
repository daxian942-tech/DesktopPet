/**
 * 动物桌宠专属叫声（程序化合成，零素材体积）。
 *
 * 每种动物有自己的基频、滑音走向、音色与时长；同一个叫声在
 * feed / drink / play / bath 四种情境下有音高与节奏变体。
 *
 * 设计原则：
 * - 用 Web Audio 节点现合成，不加载任何外部音频文件（exe 体积不变）
 * - 所有节点在 onended 里断开，不留常驻节点
 * - 任何异常都吞掉：WebView2 / WKWebView / WebKitGTK 缺音频硬件时静默降级
 * - 声音短促（<1.2s），不打扰打字
 */

import type { AnimalSpecies } from './catSkins';

export type CareVoiceAction = 'feed' | 'drink' | 'play' | 'bath';

/** 一次叫声的声学参数。 */
interface VoiceSpec {
  /** 基础音高（Hz） */
  f0: number;
  /** 终点音高（Hz）；与 f0 不同则形成滑音 */
  f1: number;
  /** 音高曲线的中段折点比例，0.5 表示先滑到 f1 再滑回 */
  bend: number;
  /** 时长（秒） */
  dur: number;
  /** 波形 */
  wave: OscillatorType;
  /** 音色：滤波类型与中心频率 */
  filter: BiquadFilterType;
  cutoff: number;
  q: number;
  /** 音量包络峰值 */
  gain: number;
  /** 起音 / 衰减时间占时长的比例 */
  attack: number;
  /** 颤音频率与深度（Hz / 相对音高） */
  vibrato: number;
  vibratoDepth: number;
  /** 重复次数与间隔（秒），用于"汪汪""嘎嘎" */
  repeat: number;
  gap: number;
  /** 气声成分（0..1），模拟鼻息/咀嚼 */
  breath: number;
}

/** 每种动物的基础叫声。参数经过调音，尽量一耳朵能分辨。 */
const VOICES: Record<AnimalSpecies, VoiceSpec> = {
  cat: { f0: 620, f1: 460, bend: 0.45, dur: 0.42, wave: 'sine', filter: 'bandpass', cutoff: 1500, q: 1.2, gain: 0.10, attack: 0.12, vibrato: 5, vibratoDepth: 0.02, repeat: 1, gap: 0, breath: 0.10 },
  dog: { f0: 520, f1: 170, bend: 0.30, dur: 0.20, wave: 'triangle', filter: 'bandpass', cutoff: 900, q: 1.0, gain: 0.14, attack: 0.08, vibrato: 0, vibratoDepth: 0, repeat: 2, gap: 0.16, breath: 0.28 },
  fox: { f0: 900, f1: 1450, bend: 0.55, dur: 0.26, wave: 'sawtooth', filter: 'bandpass', cutoff: 2600, q: 2.4, gain: 0.075, attack: 0.14, vibrato: 12, vibratoDepth: 0.04, repeat: 1, gap: 0, breath: 0.16 },
  panda: { f0: 250, f1: 175, bend: 0.60, dur: 0.55, wave: 'triangle', filter: 'lowpass', cutoff: 700, q: 0.8, gain: 0.12, attack: 0.18, vibrato: 4, vibratoDepth: 0.03, repeat: 1, gap: 0, breath: 0.30 },
  bunny: { f0: 1150, f1: 1500, bend: 0.40, dur: 0.13, wave: 'sine', filter: 'bandpass', cutoff: 3200, q: 3.0, gain: 0.065, attack: 0.20, vibrato: 0, vibratoDepth: 0, repeat: 2, gap: 0.10, breath: 0.08 },
  penguin: { f0: 340, f1: 280, bend: 0.50, dur: 0.15, wave: 'square', filter: 'bandpass', cutoff: 1100, q: 1.8, gain: 0.085, attack: 0.10, vibrato: 0, vibratoDepth: 0, repeat: 3, gap: 0.13, breath: 0.14 },
  frog: { f0: 190, f1: 150, bend: 0.35, dur: 0.30, wave: 'sawtooth', filter: 'lowpass', cutoff: 620, q: 2.2, gain: 0.13, attack: 0.10, vibrato: 26, vibratoDepth: 0.10, repeat: 2, gap: 0.18, breath: 0.20 },
  chiikawa: { f0: 1400, f1: 1900, bend: 0.55, dur: 0.11, wave: 'sine', filter: 'bandpass', cutoff: 3800, q: 3.5, gain: 0.055, attack: 0.18, vibrato: 18, vibratoDepth: 0.05, repeat: 2, gap: 0.09, breath: 0.06 },
  grasscow: { f0: 155, f1: 92, bend: 0.62, dur: 0.95, wave: 'sawtooth', filter: 'bandpass', cutoff: 480, q: 2.6, gain: 0.16, attack: 0.22, vibrato: 6, vibratoDepth: 0.06, repeat: 1, gap: 0, breath: 0.34 },
  milkdragon: { f0: 430, f1: 640, bend: 0.50, dur: 0.58, wave: 'sine', filter: 'lowpass', cutoff: 1800, q: 0.9, gain: 0.12, attack: 0.20, vibrato: 7, vibratoDepth: 0.05, repeat: 1, gap: 0, breath: 0.12 },
  capybara: { f0: 210, f1: 165, bend: 0.55, dur: 0.40, wave: 'triangle', filter: 'lowpass', cutoff: 560, q: 1.1, gain: 0.11, attack: 0.16, vibrato: 5, vibratoDepth: 0.03, repeat: 1, gap: 0, breath: 0.22 },
  loopy: { f0: 780, f1: 1050, bend: 0.45, dur: 0.30, wave: 'sine', filter: 'bandpass', cutoff: 2200, q: 2.0, gain: 0.085, attack: 0.18, vibrato: 9, vibratoDepth: 0.04, repeat: 1, gap: 0, breath: 0.10 },
  bubu: { f0: 330, f1: 240, bend: 0.50, dur: 0.38, wave: 'triangle', filter: 'bandpass', cutoff: 780, q: 1.6, gain: 0.10, attack: 0.20, vibrato: 11, vibratoDepth: 0.07, repeat: 1, gap: 0, breath: 0.42 },
};

/** 情境变体：对基础参数做微调。 */
function variant(base: VoiceSpec, action: CareVoiceAction): VoiceSpec {
  switch (action) {
    case 'feed':
      // 吃东西时略微降调、变短，并加咀嚼气声
      return { ...base, f0: base.f0 * 0.94, f1: base.f1 * 0.94, dur: base.dur * 0.72, breath: Math.min(0.6, base.breath + 0.18), repeat: 1, gap: 0 };
    case 'drink':
      // 喝水时圆润下滑、尾音拖长
      return { ...base, f0: base.f0 * 1.04, f1: base.f0 * 0.72, bend: 0.40, dur: base.dur * 0.85, breath: base.breath + 0.08, repeat: 1, gap: 0 };
    case 'play':
      // 玩耍时上扬、轻快、重复
      return { ...base, f0: base.f0 * 1.12, f1: base.f1 * 1.18, dur: base.dur * 0.8, repeat: Math.max(2, base.repeat), gap: base.gap || 0.12, gain: base.gain * 0.9 };
    case 'bath':
      // 洗澡时惊讶短促
      return { ...base, f0: base.f0 * 1.18, f1: base.f1 * 1.08, dur: base.dur * 0.62, gain: base.gain * 0.85, breath: base.breath + 0.12, repeat: 1, gap: 0 };
  }
}

function env(ctx: AudioContext, node: AudioNode, spec: VoiceSpec, t0: number, out: AudioNode): void {
  const g = ctx.createGain();
  const a = Math.max(0.008, spec.dur * spec.attack);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(spec.gain, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
  node.connect(g);
  g.connect(out);
}

/** 合成单声"叫"。 */
function chirp(ctx: AudioContext, spec: VoiceSpec, t0: number, out: AudioNode): void {
  const osc = ctx.createOscillator();
  osc.type = spec.wave;
  osc.frequency.setValueAtTime(spec.f0, t0);
  const mid = t0 + spec.dur * spec.bend;
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, spec.f1), mid);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, spec.f0 * 0.82), t0 + spec.dur);

  if (spec.vibrato > 0) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = spec.vibrato;
    lg.gain.value = spec.f0 * spec.vibratoDepth;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + spec.dur + 0.02);
    lfo.onended = () => { try { lfo.disconnect(); lg.disconnect(); } catch { /* ignore */ } };
  }

  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter;
  filter.frequency.setValueAtTime(spec.cutoff, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(120, spec.cutoff * 0.7), t0 + spec.dur);
  filter.Q.value = spec.q;

  osc.connect(filter);
  env(ctx, filter, spec, t0, out);
  osc.start(t0);
  osc.stop(t0 + spec.dur + 0.02);
  osc.onended = () => { try { osc.disconnect(); filter.disconnect(); } catch { /* ignore */ } };

  // 气声层（鼻息 / 咀嚼 / 布偶沙哑感）
  if (spec.breath > 0.04) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * spec.dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.max(300, spec.cutoff * 1.4);
    bp.Q.value = 1.1;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t0);
    bg.gain.linearRampToValueAtTime(spec.gain * spec.breath, t0 + Math.min(0.05, spec.dur * 0.25));
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
    src.connect(bp);
    bp.connect(bg);
    bg.connect(out);
    src.start(t0);
    src.stop(t0 + spec.dur);
    src.onended = () => { try { src.disconnect(); bp.disconnect(); bg.disconnect(); } catch { /* ignore */ } };
  }
}

/** 喝水/吃东西的液体咕咚或咀嚼节拍，叠在叫声后。 */
function chewOrGulp(ctx: AudioContext, action: CareVoiceAction, t0: number, out: AudioNode, species: AnimalSpecies): void {
  if (action !== 'feed' && action !== 'drink') return;
  const isGulp = action === 'drink';
  const count = isGulp ? 3 : 4;
  const gap = isGulp ? 0.13 : 0.095;
  for (let i = 0; i < count; i++) {
    const t = t0 + 0.12 + i * gap;
    // 牛/水豚等大型动物咀嚼更低沉
    const big = species === 'grasscow' || species === 'capybara' || species === 'panda';
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f = isGulp ? (big ? 150 : 260) : (big ? 110 : 190);
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * (isGulp ? 0.6 : 0.75), t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(isGulp ? 0.055 : 0.04, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 0.10);
    osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch { /* ignore */ } };
  }
}

/** 播放某种动物的叫声。ctx 由外部（CatAudio）管理。 */
export function playCreatureVoice(
  ctx: AudioContext,
  species: AnimalSpecies,
  action: CareVoiceAction,
): void {
  try {
    if (!Number.isFinite(ctx.currentTime)) return;
    const base = VOICES[species] ?? VOICES.cat;
    const spec = variant(base, action);
    const t0 = ctx.currentTime + 0.01;
    for (let i = 0; i < spec.repeat; i++) {
      chirp(ctx, spec, t0 + i * (spec.dur + spec.gap), ctx.destination);
    }
    chewOrGulp(ctx, action, t0, ctx.destination, species);
  } catch {
    // 静默降级：缺音频硬件 / 自动播放被拦截时不影响桌宠
  }
}
