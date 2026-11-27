/**
 * 提醒功能。
 *
 * 用户设置「几点几分 + 说什么 + 一次/每天」，到点后桌宠自动跑到屏幕中间，
 * 头顶弹出大字提醒并叫一声（叫声走当前物种）。
 *
 * 数据存 localStorage（和养成状态同一层），每 10 秒扫一次，
 * 只比对「小时:分钟」，命中且当天没触发过就触发一次。
 * 用 10 秒而不是 1 秒，是为了避免 60fps 渲染循环外的额外唤醒；
 * 到点精度在 10 秒内，对「提醒喝水/开会」这类场景足够。
 */

export type ReminderRepeat = 'once' | 'daily';

export interface Reminder {
  id: string;
  /** "HH:MM" 24 小时制 */
  time: string;
  text: string;
  repeat: ReminderRepeat;
  enabled: boolean;
  /** 上次触发的日期 "YYYY-MM-DD"，用于同日去重 */
  lastFired?: string;
}

const STORAGE_KEY = 'desktop-pet-reminders-v1';
const TICK_MS = 10_000;

function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeTime(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return '09:00';
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mi = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${`${h}`.padStart(2, '0')}:${`${mi}`.padStart(2, '0')}`;
}

export function makeReminderId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeReminder(raw: Partial<Reminder>): Reminder {
  return {
    id: raw.id || makeReminderId(),
    time: normalizeTime(raw.time || '09:00'),
    text: (raw.text || '时间到啦').slice(0, 40),
    repeat: raw.repeat === 'daily' ? 'daily' : 'once',
    enabled: raw.enabled !== false,
    lastFired: raw.lastFired,
  };
}

export function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeReminder);
  } catch {
    return [];
  }
}

export function saveReminders(list: Reminder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 配额满或隐私模式，忽略
  }
}

/** 排序：按时间升序。 */
export function sortReminders(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => a.time.localeCompare(b.time));
}

export interface ReminderScheduler {
  /** 开始监听，到点调 onFire */
  start: (onFire: (r: Reminder) => void) => void;
  stop: () => void;
  /** 立即扫一次（设置改变后调用） */
  tickNow: () => void;
  /** 下一次触发还剩多少秒（用于 UI 显示） */
  nextIn: () => number | null;
}

/**
 * 创建调度器。每次 tick 比对当前 "HH:MM"；
 * 命中且 enabled、且（once 未触发过 / daily 今天未触发）就触发。
 */
export function createReminderScheduler(getList: () => Reminder[]): ReminderScheduler {
  let timer: number | null = null;
  let onFireCb: ((r: Reminder) => void) | null = null;
  // 同一次会话里已经触发过的 key（id + 日期），避免 tick 密集时重复触发
  const fired = new Set<string>();

  const check = () => {
    const now = new Date();
    const hh = `${now.getHours()}`.padStart(2, '0');
    const mm = `${now.getMinutes()}`.padStart(2, '0');
    const cur = `${hh}:${mm}`;
    const today = todayKey(now);
    for (const r of getList()) {
      if (!r.enabled || r.time !== cur) continue;
      if (r.repeat === 'once' && r.lastFired) continue;
      if (r.repeat === 'daily' && r.lastFired === today) continue;
      const key = `${r.id}:${today}:${r.time}`;
      if (fired.has(key)) continue;
      fired.add(key);
      onFireCb?.(r);
    }
  };

  return {
    start(onFire) {
      onFireCb = onFire;
      if (timer !== null) return;
      timer = window.setInterval(check, TICK_MS);
      // 启动时也扫一次，覆盖「刚好设成当前分钟」的情况
      check();
    },
    stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    },
    tickNow: check,
    nextIn() {
      const now = new Date();
      let best: number | null = null;
      for (const r of getList()) {
        if (!r.enabled) continue;
        const [h, m] = r.time.split(':').map((x) => parseInt(x, 10));
        const target = new Date(now);
        target.setHours(h, m, 0, 0);
        if (r.repeat === 'daily' && r.lastFired === todayKey(now)) {
          target.setDate(target.getDate() + 1);
        } else if (target.getTime() <= now.getTime()) {
          if (r.repeat === 'once') continue;
          target.setDate(target.getDate() + 1);
        }
        const sec = Math.round((target.getTime() - now.getTime()) / 1000);
        if (sec >= 0 && (best === null || sec < best)) best = sec;
      }
      return best;
    },
  };
}
