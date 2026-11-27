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

/** 交互音效：抚摸满足声 / 被戳一下 / 甩尾巴。 */
export type TouchVoiceKind = 'purr' | 'boop' | 'flick';

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
  // 猫保留原样（猫有自己的真实呼噜体系，这里只作兜底）
  cat: { f0: 620, f1: 460, bend: 0.45, dur: 0.42, wave: 'sine', filter: 'lowpass', cutoff: 1600, q: 0.8, gain: 0.10, attack: 0.14, vibrato: 5, vibratoDepth: 0.015, repeat: 1, gap: 0, breath: 0.08 },
  // 犬科：中低音、软三角波，短促「嗷」
  dog: { f0: 430, f1: 210, bend: 0.35, dur: 0.22, wave: 'triangle', filter: 'lowpass', cutoff: 900, q: 0.7, gain: 0.11, attack: 0.10, vibrato: 0, vibratoDepth: 0, repeat: 2, gap: 0.15, breath: 0.16 },
  // 狐狸：降基频到 620，正弦，避免原来 900-1450 锯齿的哨音
  fox: { f0: 620, f1: 880, bend: 0.50, dur: 0.28, wave: 'sine', filter: 'lowpass', cutoff: 1700, q: 0.9, gain: 0.085, attack: 0.16, vibrato: 7, vibratoDepth: 0.02, repeat: 1, gap: 0, breath: 0.10 },
  // 熊猫：温柔低频哼
  panda: { f0: 245, f1: 190, bend: 0.58, dur: 0.55, wave: 'sine', filter: 'lowpass', cutoff: 620, q: 0.7, gain: 0.11, attack: 0.22, vibrato: 4, vibratoDepth: 0.02, repeat: 1, gap: 0, breath: 0.14 },
  // 兔子：降基频到 820，短促「啾」，可爱但不高尖
  bunny: { f0: 820, f1: 1050, bend: 0.42, dur: 0.14, wave: 'sine', filter: 'lowpass', cutoff: 2000, q: 0.9, gain: 0.075, attack: 0.22, vibrato: 0, vibratoDepth: 0, repeat: 2, gap: 0.11, breath: 0.05 },
  // 企鹅：三角波替代方波，中低频「嘎」
  penguin: { f0: 330, f1: 265, bend: 0.50, dur: 0.16, wave: 'triangle', filter: 'lowpass', cutoff: 850, q: 0.8, gain: 0.095, attack: 0.12, vibrato: 0, vibratoDepth: 0, repeat: 3, gap: 0.14, breath: 0.12 },
  // 青蛙：正弦替代锯齿，颤音深度从 0.10 降到 0.03
  frog: { f0: 185, f1: 150, bend: 0.38, dur: 0.32, wave: 'sine', filter: 'lowpass', cutoff: 520, q: 0.9, gain: 0.115, attack: 0.14, vibrato: 14, vibratoDepth: 0.03, repeat: 2, gap: 0.19, breath: 0.14 },
  // 吉伊：基频从 1400 降到 880，柔和小「吱」，奶气但不刺
  chiikawa: { f0: 880, f1: 1150, bend: 0.52, dur: 0.13, wave: 'sine', filter: 'lowpass', cutoff: 2100, q: 0.9, gain: 0.07, attack: 0.24, vibrato: 10, vibratoDepth: 0.02, repeat: 2, gap: 0.10, breath: 0.04 },
  // 牛：正弦替代锯齿，低频稳定「哞」
  grasscow: { f0: 150, f1: 100, bend: 0.60, dur: 0.92, wave: 'sine', filter: 'lowpass', cutoff: 460, q: 0.7, gain: 0.13, attack: 0.26, vibrato: 5, vibratoDepth: 0.03, repeat: 1, gap: 0, breath: 0.18 },
  // 奶龙：奶萌「嗷呜」，正弦上行
  milkdragon: { f0: 400, f1: 580, bend: 0.50, dur: 0.56, wave: 'sine', filter: 'lowpass', cutoff: 1300, q: 0.8, gain: 0.11, attack: 0.24, vibrato: 6, vibratoDepth: 0.025, repeat: 1, gap: 0, breath: 0.08 },
  // 水豚：低沉慢哼
  capybara: { f0: 200, f1: 168, bend: 0.55, dur: 0.42, wave: 'sine', filter: 'lowpass', cutoff: 500, q: 0.7, gain: 0.10, attack: 0.22, vibrato: 4, vibratoDepth: 0.02, repeat: 1, gap: 0, breath: 0.12 },
  // 露比：软萌「呜」，正弦
  loopy: { f0: 640, f1: 850, bend: 0.46, dur: 0.32, wave: 'sine', filter: 'lowpass', cutoff: 1600, q: 0.9, gain: 0.085, attack: 0.20, vibrato: 7, vibratoDepth: 0.02, repeat: 1, gap: 0, breath: 0.08 },
  // 布布：布偶感的软三角低频，颤音收敛
  bubu: { f0: 300, f1: 235, bend: 0.50, dur: 0.40, wave: 'triangle', filter: 'lowpass', cutoff: 700, q: 0.7, gain: 0.095, attack: 0.24, vibrato: 8, vibratoDepth: 0.03, repeat: 1, gap: 0, breath: 0.22 },
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

/**
 * 正在播放的合成音源注册表（按 AudioContext 隔离）。
 * 切物种时调 stopAllCreatureVoices 一次性停掉，避免上一只动物的叫声拖在新动物身上。
 */
type Stoppable = { stop: () => void };
const activeByCtx = new WeakMap<AudioContext, Set<Stoppable>>();

function track(ctx: AudioContext, node: Stoppable): void {
  let set = activeByCtx.get(ctx);
  if (!set) {
    set = new Set();
    activeByCtx.set(ctx, set);
  }
  set.add(node);
}

function untrack(ctx: AudioContext, node: Stoppable): void {
  activeByCtx.get(ctx)?.delete(node);
}

/** 立刻停掉这个上下文里所有正在响的动物声音（切物种 / 静音时调用）。 */
export function stopAllCreatureVoices(ctx: AudioContext | null): void {
  if (!ctx) return;
  const set = activeByCtx.get(ctx);
  if (!set) return;
  for (const node of [...set]) {
    try {
      node.stop();
    } catch {
      // 已经停过
    }
  }
  set.clear();
}

/**
 * 柔化总线：所有合成叫声都先经过这个低通滤波，
 * 把 4kHz 以上的毛刺削掉——这是"刺耳"的主要来源（锯齿/方波的谐波）。
 */
function softBus(ctx: AudioContext, out: AudioNode): BiquadFilterNode {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4200;
  lp.Q.value = 0.5;
  // 再叠一个高架削一点齿音
  const shelf = ctx.createBiquadFilter();
  shelf.type = 'highshelf';
  shelf.frequency.value = 6000;
  shelf.gain.value = -9;
  lp.connect(shelf);
  shelf.connect(out);
  return lp;
}

function env(ctx: AudioContext, node: AudioNode, spec: VoiceSpec, t0: number, out: AudioNode): void {
  const g = ctx.createGain();
  const a = Math.max(0.012, spec.dur * spec.attack);
  g.gain.setValueAtTime(0.0001, t0);
  // 用 setTargetAtTime 做平滑起音，避免 linearRamp 的硬拐点产生"咔"声
  g.gain.setTargetAtTime(spec.gain, t0 + a * 0.35, Math.max(0.006, a * 0.32));
  g.gain.setTargetAtTime(0.0001, t0 + spec.dur * 0.72, Math.max(0.02, spec.dur * 0.18));
  node.connect(g);
  g.connect(out);
}

/** 合成单声"叫"。所有输出都先过柔化总线，避免锯齿谐波扎耳朵。 */
function chirp(ctx: AudioContext, spec: VoiceSpec, t0: number, tap: AudioNode): void {
  const out = softBus(ctx, tap);
  const osc = ctx.createOscillator();
  osc.type = spec.wave;
  osc.frequency.setValueAtTime(spec.f0, t0);
  const mid = t0 + spec.dur * spec.bend;
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, spec.f1), mid);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, spec.f0 * 0.82), t0 + spec.dur);

  // 颤音保持很浅（≤3%），深颤音是"哇哇"怪声的来源
  let lfo: OscillatorNode | null = null;
  let lg: GainNode | null = null;
  if (spec.vibrato > 0 && spec.vibratoDepth > 0.001) {
    lfo = ctx.createOscillator();
    lg = ctx.createGain();
    lfo.frequency.value = spec.vibrato;
    lg.gain.value = spec.f0 * spec.vibratoDepth;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + spec.dur + 0.02);
    lfo.onended = () => { try { lfo!.disconnect(); lg!.disconnect(); } catch { /* ignore */ } };
  }

  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter;
  filter.frequency.setValueAtTime(spec.cutoff, t0);
  filter.frequency.linearRampToValueAtTime(Math.max(160, spec.cutoff * 0.82), t0 + spec.dur);
  filter.Q.value = Math.max(0.5, Math.min(1.1, spec.q));

  osc.connect(filter);
  env(ctx, filter, spec, t0, out);

  // 只注册主振荡器：stop 它会连带静音（filter/gain 没声源就不响）
  const stopper: Stoppable = {
    stop: () => {
      try { osc.stop(); } catch { /* ignore */ }
      try { osc.disconnect(); } catch { /* ignore */ }
    },
  };
  track(ctx, stopper);
  osc.onended = () => {
    untrack(ctx, stopper);
    try { osc.disconnect(); filter.disconnect(); } catch { /* ignore */ }
  };
  osc.start(t0);
  osc.stop(t0 + spec.dur + 0.02);

  // 气声层（鼻息 / 咀嚼 / 布偶沙哑感）——也走柔化总线，音量再压一点
  if (spec.breath > 0.04) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * spec.dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    // 气声中心频率压到 1.2kHz 以下，避免"嘶"的高频噪音
    bp.frequency.value = Math.min(1200, Math.max(260, spec.cutoff * 0.9));
    bp.Q.value = 0.8;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t0);
    bg.gain.setTargetAtTime(
      spec.gain * spec.breath * 0.55,
      t0 + Math.min(0.05, spec.dur * 0.25),
      Math.max(0.01, spec.dur * 0.2),
    );
    bg.gain.setTargetAtTime(0.0001, t0 + spec.dur * 0.7, Math.max(0.02, spec.dur * 0.2));
    src.connect(bp);
    bp.connect(bg);
    bg.connect(out);

    const breathStopper: Stoppable = {
      stop: () => {
        try { src.stop(); } catch { /* ignore */ }
        try { src.disconnect(); } catch { /* ignore */ }
      },
    };
    track(ctx, breathStopper);
    src.onended = () => {
      untrack(ctx, breathStopper);
      try { src.disconnect(); bp.disconnect(); bg.disconnect(); } catch { /* ignore */ }
    };
    src.start(t0);
    src.stop(t0 + spec.dur);
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
    // 一次叫声共用一个柔化总线，避免每个 chirp 都新建滤波链
    const bus = softBus(ctx, ctx.destination);
    for (let i = 0; i < spec.repeat; i++) {
      chirp(ctx, spec, t0 + i * (spec.dur + spec.gap), bus);
    }
    chewOrGulp(ctx, action, t0, bus, species);
  } catch {
    // 静默降级：缺音频硬件 / 自动播放被拦截时不影响桌宠
  }
}

/**
 * 非猫物种的「抚摸满足声」：一段低频颤动的咕噜。
 *
 * 猫的呼噜是真实录音循环；其余动物没有可循环的素材，这里用低频三角波
 * 加 28Hz 的振幅颤动合成一个柔软的喉音，音高按物种基频缩放，
 * 所以牛是低沉的、吉伊是细高的。返回建议的重复间隔（秒），
 * 由调用方在抚摸持续期间定时重触发。
 */
export function playCreaturePurr(
  ctx: AudioContext,
  species: AnimalSpecies,
  intensity = 0.8,
): number {
  try {
    if (!Number.isFinite(ctx.currentTime)) return 0.9;
    const base = VOICES[species] ?? VOICES.cat;
    // 喉音基频：取物种基频的 35%~45%，大型动物更低
    const big = species === 'grasscow' || species === 'capybara' || species === 'panda';
    const f = Math.max(42, base.f0 * (big ? 0.30 : 0.42));
    const dur = 0.85;
    const t0 = ctx.currentTime + 0.01;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t0);
    osc.frequency.linearRampToValueAtTime(f * 1.03, t0 + dur);

    // 呼噜的颤动：用一个低频 LFO 直接调制音量
    const tremolo = ctx.createOscillator();
    const tremGain = ctx.createGain();
    tremolo.frequency.value = big ? 22 : 28;
    tremGain.gain.value = 0.45;
    tremolo.connect(tremGain);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(320, base.cutoff * 0.55);
    lp.Q.value = 0.8;

    const g = ctx.createGain();
    const peak = 0.062 * Math.max(0.2, Math.min(1, intensity));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.setTargetAtTime(peak, t0 + 0.06, 0.05);
    g.gain.setTargetAtTime(0.0001, t0 + dur * 0.82, 0.06);
    // LFO 接到主增益上做振幅颤动
    tremGain.connect(g.gain);

    const bus = softBus(ctx, ctx.destination);
    osc.connect(lp);
    lp.connect(g);
    g.connect(bus);

    osc.start(t0);
    tremolo.start(t0);
    osc.stop(t0 + dur + 0.02);
    tremolo.stop(t0 + dur + 0.02);

    const stopper: Stoppable = {
      stop: () => {
        try { osc.stop(); } catch { /* ignore */ }
        try { tremolo.stop(); } catch { /* ignore */ }
        try { osc.disconnect(); } catch { /* ignore */ }
      },
    };
    track(ctx, stopper);
    const cleanup = () => {
      untrack(ctx, stopper);
      try {
        osc.disconnect(); lp.disconnect(); g.disconnect();
        tremolo.disconnect(); tremGain.disconnect();
      } catch { /* ignore */ }
    };
    osc.onended = cleanup;

    return dur;
  } catch {
    return 0.9;
  }
}

/**
 * 非猫物种的「被戳 / 甩尾」短音。
 * boop：短促上扬的「嗯？」；flick：快速下滑的「唰」。
 */
export function playCreatureTouch(
  ctx: AudioContext,
  species: AnimalSpecies,
  kind: TouchVoiceKind,
): void {
  try {
    if (!Number.isFinite(ctx.currentTime)) return;
    const base = VOICES[species] ?? VOICES.cat;
    const t0 = ctx.currentTime + 0.008;

    const osc = ctx.createOscillator();
    osc.type = kind === 'boop' ? 'sine' : 'triangle';
    const f0 = base.f0 * (kind === 'boop' ? 1.0 : 1.25);
    const f1 = kind === 'boop' ? f0 * 1.55 : f0 * 0.55;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + (kind === 'boop' ? 0.10 : 0.085));

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(500, base.cutoff);
    lp.Q.value = 1.0;

    const g = ctx.createGain();
    const peak = base.gain * (kind === 'boop' ? 0.75 : 0.55);
    const dur = kind === 'boop' ? 0.13 : 0.11;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.setTargetAtTime(peak, t0 + 0.02, 0.012);
    g.gain.setTargetAtTime(0.0001, t0 + dur * 0.6, 0.03);

    const bus = softBus(ctx, ctx.destination);
    osc.connect(lp);
    lp.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);

    const stopper: Stoppable = {
      stop: () => {
        try { osc.stop(); } catch { /* ignore */ }
        try { osc.disconnect(); } catch { /* ignore */ }
      },
    };
    track(ctx, stopper);
    osc.onended = () => {
      untrack(ctx, stopper);
      try { osc.disconnect(); lp.disconnect(); g.disconnect(); } catch { /* ignore */ }
    };
  } catch {
    // 静默降级
  }
}
