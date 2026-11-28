/**
 * Companion features — bond / ambient awareness / proactive chatter / typing semantics
 * (11-28 18:30). All four run on the SAME path for cats and non-cat animals:
 * the only outward effects are a DOM speech bubble (agentCompanion) and a
 * generic "action" callback, neither of which cares which render engine is live.
 *
 * Design rules:
 *  - Zero changes to the two engines. Everything is driven through a Host interface.
 *  - Every feature has its own enable flag. Typing semantics is OFF by default
 *    (privacy sensitive) and must be explicitly opted in from settings.
 *  - All state persists in its own localStorage key, with safe defaults so old
 *    installs and private windows never throw.
 */

/** Actions the host can perform; it maps them to cat demos or non-cat moods. */
export type CompanionAction =
  | 'happy' | 'curious' | 'sleep' | 'wake' | 'angry' | 'pat';

export interface CompanionHost {
  /** Show the pet's speech bubble. Works for both cats and non-cats. */
  say(text: string, ttlMs?: number): void;
  /** Trigger a short emotion/action. The host decides the engine-specific path. */
  act(action: CompanionAction): void;
  /** Current species id, used to pick personality-flavoured lines. */
  speciesId(): string;
  /** Whether a privacy screen (password field) is active. */
  isPrivate(): boolean;
  /** Whether the user is likely concentrating (game / explicit focus). */
  isFocused(): boolean;
  /** All feature switches, read each tick so settings changes take effect live. */
  flags(): CompanionFlags;
}

export interface CompanionFlags {
  bond: boolean;
  ambient: boolean;
  proactive: boolean;
  typingSemantics: boolean;
}

export interface BondState {
  /** 0..100 affection earned from care, petting and time spent together. */
  points: number;
  /** Lifetime counters. */
  feeds: number;
  pets: number;
  plays: number;
  /** Epoch ms when this companion was first met. */
  firstMetAt: number;
  /** Last calendar day (YYYY-MM-DD) a summary was given. */
  lastSummaryDay: string;
  /** Rolling tally of active minutes today, keyed by day. */
  activeMinutes: Record<string, number>;
  /** Hours the user most often interacts with the pet, 0..23. */
  activeHours: number[];
  /** Last time we spoke, to avoid pestering. */
  lastSpokenAt: number;
}

const STORAGE_KEY = 'kurocat_companion_v1';

function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultBond(): BondState {
  return {
    points: 8,
    feeds: 0,
    pets: 0,
    plays: 0,
    firstMetAt: Date.now(),
    lastSummaryDay: '',
    activeMinutes: {},
    activeHours: [],
    lastSpokenAt: 0,
  };
}

function loadBond(): BondState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultBond();
    const p = JSON.parse(raw) as Partial<BondState>;
    const base = defaultBond();
    return {
      points: Math.max(0, Math.min(100, Number(p.points ?? base.points))),
      feeds: Math.max(0, Number(p.feeds ?? 0)),
      pets: Math.max(0, Number(p.pets ?? 0)),
      plays: Math.max(0, Number(p.plays ?? 0)),
      firstMetAt: Number(p.firstMetAt ?? base.firstMetAt) || base.firstMetAt,
      lastSummaryDay: typeof p.lastSummaryDay === 'string' ? p.lastSummaryDay : '',
      activeMinutes: p.activeMinutes && typeof p.activeMinutes === 'object' ? p.activeMinutes : {},
      activeHours: Array.isArray(p.activeHours) ? p.activeHours.filter((h) => Number.isInteger(h) && h >= 0 && h <= 23) : [],
      lastSpokenAt: Number(p.lastSpokenAt ?? 0) || 0,
    };
  } catch {
    return defaultBond();
  }
}

/** 0..5. Affection tiers unlock warmer language. */
export function bondLevel(points: number): number {
  if (points >= 85) return 5;
  if (points >= 65) return 4;
  if (points >= 45) return 3;
  if (points >= 28) return 2;
  if (points >= 14) return 1;
  return 0;
}

const BOND_NAMES = ['刚认识', '有点熟', '好朋友', '亲密伙伴', '形影不离', '最佳拍档'];

/* ---------------- personality-flavoured lines ---------------- */

interface Persona {
  /** Short affectionate ways to greet the user. */
  greetings: string[];
  /** Lines when the user pets them. */
  petted: string[];
  /** Lines when the user returns after a long absence. */
  WelcomeBack: string[];
  /** Lines when it notices the user working late. */
  late: string[];
  /** Lines for a low battery. */
  battery: string[];
  /** Lines for an offline moment. */
  offline: string[];
  /** Lines when the user is concentrating (and the pet stays quiet). */
  focus: string[];
}

const DEFAULT_PERSONA: Persona = {
  greetings: ['你来啦！', '今天也一起加油吧～', '嘿嘿，又见面了'],
  petted: ['好舒服呀～', '再摸摸嘛', '嘿嘿，被摸到了'],
  WelcomeBack: ['你终于回来啦！', '我还以为你把我忘了…', '欢迎回来！'],
  late: ['这么晚啦，早点休息哦', '还在忙呀？别太累了', '夜深了，我陪你一会儿'],
  battery: ['电脑快没电啦，记得充电哦', '电量告急！先插上电源吧'],
  offline: ['好像断网了…我先陪你待着', '网络掉线了，不过我还在'],
  focus: ['我不打扰你啦', '专心做事，我在旁边陪着'],
};

const PERSONAS: Record<string, Persona> = {
  chiikawa: {
    greetings: ['你、你来啦…', '今天…也在一起吗？', '嘿嘿…好开心…'],
    petted: ['谢、谢谢摸摸…', '我…我很开心…', '被摸到了…呜…'],
    WelcomeBack: ['你终于…回来了…我还以为…', '呜…我等了好久…', '回来就好…'],
    late: ['这、这么晚了…快睡吧…', '别、别熬太晚…', '我陪你…一会儿就好…'],
    battery: ['电、电量…要没了…', '快、快充电呀…'],
    offline: ['网…网络不见了…', '我、我有点慌…'],
    focus: ['我…我安静待着…', '不打扰你啦…'],
  },
  grasscow: {
    greetings: ['唉，你来了啊…', '还得上班吗…', '今天也是苦命的一天…'],
    petted: ['算了，给你摸吧…', '唉…舒服是舒服…', '就当加班补偿了…'],
    WelcomeBack: ['我还以为你不要我了…', '回来啦…行吧…', '哼，我可没等你…'],
    late: ['都这么晚了还要忙…苦命啊…', '早点睡吧，别跟我一样…', '熬夜伤身…我懂…'],
    battery: ['电都没了，真够惨的…', '快充电，别学我这么惨…'],
    offline: ['网断了…这也太苦命了…', '唉，连网都欺负我…'],
    focus: ['我不吵你…', '唉，忙你的吧…'],
  },
  milkdragon: {
    greetings: ['嗷呜！你来啦！', '嘿嘿，今天玩什么？', '本龙等你很久啦！'],
    petted: ['哈哈，再摸！', '舒服～本龙喜欢！', '嘿嘿嘿，好痒～'],
    WelcomeBack: ['你终于回来啦！本龙好无聊！', '哼！居然让我等这么久！', '回来就好，快陪我玩！'],
    late: ['这么晚啦！快去睡！', '熬夜可不行，本龙批准你去睡！', '再不睡本龙要生气了！'],
    battery: ['电脑要没电啦！快充！', '电量危险！本龙命令你充电！'],
    offline: ['网断了？那陪我玩嘛！', '没网正好，陪本龙玩！'],
    focus: ['本龙安静陪着你～', '你好好忙，我不闹～'],
  },
  capybara: {
    greetings: ['嗯…你来了…', '哦…', '随便啦…'],
    petted: ['…还行', '嗯…有点舒服', '随便摸吧…'],
    WelcomeBack: ['哦，回来了啊…', '嗯…我还在这儿…', '回来就回来呗…'],
    late: ['这么晚了…睡吧…', '别熬了…不值得…', '嗯…早点休息…'],
    battery: ['没电了…充一下吧…', '嗯…该充电了…'],
    offline: ['断网了啊…无所谓…', '嗯…那就歇会儿…'],
    focus: ['…我不说话', '嗯…安静陪着'],
  },
  loopy: {
    greetings: ['你、你来啦！', '今天…要一起吗？', '嘿嘿…见到你真好…'],
    petted: ['谢、谢谢…', '好、好开心…', '被摸到了…脸红…'],
    WelcomeBack: ['你回来啦…我、我一直在等你…', '呜…还以为你不来了…', '太好了…你回来了…'],
    late: ['这么晚了…快去睡吧…', '别、别太累…', '我陪你…到睡着…'],
    battery: ['电、电量…快没了…', '那个…该充电了…'],
    offline: ['网…网断了…怎么办…', '呜…我的网络…'],
    focus: ['我…我小声一点…', '你忙你的…我不吵…'],
  },
  bubu: {
    greetings: ['你好呀～', '又见面了，朋友～', '今天过得怎么样？'],
    petted: ['谢谢你的摸摸～', '好温柔呀…', '嘿嘿，好舒服～'],
    WelcomeBack: ['欢迎回来！我等你好久啦～', '你终于回来了～', '见到你真开心～'],
    late: ['夜深了，要注意身体哦', '工作再忙也要休息呀', '我陪你到睡前～'],
    battery: ['电脑快没电啦，记得充电～', '电量不足哦，快充上吧～'],
    offline: ['好像断网了…没关系，我还在～', '网络休息一下，我们也歇歇～'],
    focus: ['我不打扰你啦～', '好好专注，我在这儿～'],
  },
};

function personaFor(id: string): Persona {
  return PERSONAS[id] ?? DEFAULT_PERSONA;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] ?? arr[0];
}

/* ---------------- the feature controller ---------------- */

export class CompanionFeatures {
  private readonly host: CompanionHost;
  private bond: BondState;
  private ambientTimer: number | null = null;
  private proactiveTimer: number | null = null;
  private minuteTimer: number | null = null;
  private lastGreetingDay = '';
  private lastNightNoticeDay = '';
  private lastUserInteractionAt = 0;

  constructor(host: CompanionHost) {
    this.host = host;
    this.bond = loadBond();
  }

  public getBond(): BondState {
    return { ...this.bond, activeHours: [...this.bond.activeHours] };
  }

  public getBondLevel(): number {
    return bondLevel(this.bond.points);
  }

  public getBondName(): string {
    return BOND_NAMES[this.getBondLevel()];
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bond));
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  }

  /** Called when the user cares for / pets the pet. Points scale with bond tier. */
  public recordInteraction(kind: 'feed' | 'pet' | 'play' | 'drink' | 'bath'): void {
    // A return after a long gap gets a welcome-back line (covers the "user came
    // back to the desk" case without needing OS-level lock-screen events).
    const now = Date.now();
    const wasAway = this.lastUserInteractionAt > 0 && now - this.lastUserInteractionAt > 5 * 60_000;
    this.lastUserInteractionAt = now;
    if (wasAway && this.host.flags().ambient && !this.host.isPrivate() && !this.host.isFocused()) {
      this.speak(pick(personaFor(this.host.speciesId()).WelcomeBack), 6000);
    }
    if (!this.host.flags().bond) return;
    const gain = kind === 'pet' ? 1.6 : kind === 'play' ? 2.4 : 1.8;
    this.bond.points = Math.min(100, this.bond.points + gain);
    if (kind === 'feed') this.bond.feeds += 1;
    if (kind === 'pet') this.bond.pets += 1;
    if (kind === 'play') this.bond.plays += 1;
    this.noteActiveHour();
    this.persist();
  }

  private noteActiveHour(): void {
    const hour = new Date().getHours();
    if (!this.bond.activeHours.includes(hour)) {
      this.bond.activeHours.push(hour);
      if (this.bond.activeHours.length > 8) this.bond.activeHours.shift();
    }
  }

  /** Called on every fake "minute tick" from the host (driven by a 30s timer). */
  public tickActivity(): void {
    const day = dayKey();
    this.bond.activeMinutes[day] = (this.bond.activeMinutes[day] ?? 0) + 0.5;
    this.noteActiveHour();
    this.persist();
  }

  /** Start all internal schedulers. Safe to call once. */
  public start(): void {
    // Every 30 seconds: count activity + check time-based greetings.
    this.minuteTimer = window.setInterval(() => {
      this.tickActivity();
      this.checkTimeGreetings();
    }, 30_000);
    window.setTimeout(() => this.checkTimeGreetings(), 4_000);

    // Every ~5 minutes: an optional proactive line when the user is idle-ish.
    this.proactiveTimer = window.setInterval(() => this.maybeProactive(), 5 * 60_000);

    // React to online/offline events.
    window.addEventListener('online', () => this.onNetwork(true));
    window.addEventListener('offline', () => this.onNetwork(false));
  }

  public stop(): void {
    if (this.minuteTimer !== null) window.clearInterval(this.minuteTimer);
    if (this.proactiveTimer !== null) window.clearInterval(this.proactiveTimer);
    if (this.ambientTimer !== null) window.clearTimeout(this.ambientTimer);
    this.minuteTimer = null;
    this.proactiveTimer = null;
    this.ambientTimer = null;
  }

  /* -------- ambient: time-of-day, battery, network, focus, session -------- */

  private canSpeak(): boolean {
    const f = this.host.flags();
    if (!f.ambient || this.host.isPrivate() || this.host.isFocused()) return false;
    // At most one ambient line every 3 minutes.
    return Date.now() - this.bond.lastSpokenAt > 3 * 60_000;
  }

  private speak(text: string, ttlMs = 6500): void {
    this.bond.lastSpokenAt = Date.now();
    this.persist();
    this.host.say(text, ttlMs);
  }

  private checkTimeGreetings(): void {
    if (!this.canSpeak()) return;
    const now = new Date();
    const day = dayKey(now);
    const hour = now.getHours();
    const p = personaFor(this.host.speciesId());

    // Morning greeting once a day, between 7 and 10.
    if (hour >= 7 && hour < 10 && this.lastGreetingDay !== `m:${day}`) {
      this.lastGreetingDay = `m:${day}`;
      this.speak(pick(p.greetings));
      return;
    }

    // Late-night nudge once a day, 23:00–04:00.
    if ((hour >= 23 || hour < 4) && this.lastNightNoticeDay !== day) {
      this.lastNightNoticeDay = day;
      this.speak(pick(p.late));
      return;
    }

    // Daily summary when the user comes back the next day.
    this.maybeDailySummary(day);
  }

  private maybeDailySummary(today: string): void {
    const y = new Date(Date.now() - 86_400_000);
    const yesterday = dayKey(y);
    const minutes = this.bond.activeMinutes[yesterday] ?? 0;
    if (!this.bond.lastSummaryDay && minutes >= 5) {
      this.bond.lastSummaryDay = today;
      this.speak(`昨天我们陪了 ${Math.round(minutes)} 分钟，今天也要在一起哦～`, 8000);
      this.persist();
    }
  }

  public onBatteryLow(): void {
    if (!this.host.flags().ambient || this.host.isPrivate() || this.host.isFocused()) return;
    this.speak(pick(personaFor(this.host.speciesId()).battery));
  }

  public onNetwork(online: boolean): void {
    if (!this.host.flags().ambient || this.host.isPrivate() || this.host.isFocused()) return;
    if (!online) {
      this.speak(pick(personaFor(this.host.speciesId()).offline));
    } else if (this.bond.lastSpokenAt > 0) {
      this.speak('网络回来啦～', 4500);
    }
  }

  public onSessionLock(): void {
    this.host.act('sleep');
  }

  public onFocusChanged(focused: boolean): void {
    if (!this.host.flags().ambient) return;
    if (focused && Date.now() - this.bond.lastSpokenAt > 3 * 60_000) {
      this.speak(pick(personaFor(this.host.speciesId()).focus), 4200);
    }
  }

  /* -------- proactive chatter -------- */

  private maybeProactive(): void {
    if (!this.host.flags().proactive) return;
    if (this.host.isPrivate() || this.host.isFocused()) return;
    if (Date.now() - this.bond.lastSpokenAt < 8 * 60_000) return;
    const level = this.getBondLevel();
    // Higher bond => more likely to initiate conversation.
    const chance = 0.18 + level * 0.07;
    if (Math.random() > chance) return;
    const p = personaFor(this.host.speciesId());
    const lines = [
      ...p.greetings,
      '要不要摸摸我的头？',
      '一直盯着屏幕，眼睛会累的哦～',
      '我一直在旁边陪着你呢。',
    ];
    this.speak(pick(lines), 6000);
  }

  /* -------- typing semantics (default OFF) -------- */

  /** Called for each typed character when the feature is enabled. */
  public onTypingText(text: string): void {
    if (!this.host.flags().typingSemantics) return;
    if (this.host.isPrivate() || this.host.isFocused()) return;
    const t = text.toLowerCase();
    if (/哈哈|呵呵|haha|lol|😄|😂/.test(t)) {
      this.host.act('happy');
    } else if (/加班|熬夜|好累|崩溃|烦死|累死了|ot|tired|stress/.test(t)) {
      this.host.act('pat');
      this.speak('辛苦啦，摸摸头～', 5000);
    } else if (/！！！|!!!|气死|愤怒|angry|damn/.test(t)) {
      this.host.act('angry');
    }
  }
}
