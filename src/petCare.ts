/**
 * KuroCat pet-care system: hunger / thirst / mood / energy / cleanliness.
 *
 * Pure front-end module. State lives in the main window's localStorage (the
 * pet window is always alive) and is synced across windows with Tauri events:
 *  - main  -> everyone : emit('kuro-pet-care-state', state)
 *  - menu -> main      : emit('kuro-pet-care-action', 'feed' | ...)
 *  - menu -> main      : emit('kuro-pet-care-request', null)  (on menu open)
 */

export type PetCareAction = 'feed' | 'drink' | 'play' | 'bath';

export interface PetCareState {
  /** 0 = stuffed, 100 = starving. */
  hunger: number;
  /** 0 = hydrated, 100 = parched. */
  thirst: number;
  /** 100 = delighted. */
  mood: number;
  /** 100 = fully rested. */
  energy: number;
  /** 100 = spotless. */
  clean: number;
  /** ms timestamp of the last persisted update. */
  updatedAt: number;
}

const STORAGE_KEY = 'kurocat_pet_care_v1';

/** Decay per minute. Tuned so a neglected pet changes within a couple of hours. */
const DECAY_PER_MIN = {
  hunger: 0.9,
  thirst: 1.3,
  mood: 0.7,
  energy: 0.45,
  clean: 0.55,
} as const;

const clamp = (v: number): number => Math.max(0, Math.min(100, v));

export function defaultPetCareState(): PetCareState {
  return { hunger: 18, thirst: 14, mood: 82, energy: 90, clean: 88, updatedAt: Date.now() };
}

function load(): PetCareState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPetCareState();
    const parsed = JSON.parse(raw) as Partial<PetCareState>;
    const st: PetCareState = {
      hunger: clamp(Number(parsed.hunger ?? 20)),
      thirst: clamp(Number(parsed.thirst ?? 20)),
      mood: clamp(Number(parsed.mood ?? 80)),
      energy: clamp(Number(parsed.energy ?? 85)),
      clean: clamp(Number(parsed.clean ?? 85)),
      updatedAt: Number(parsed.updatedAt ?? Date.now()) || Date.now(),
    };
    return st;
  } catch {
    return defaultPetCareState();
  }
}

function save(state: PetCareState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — keep session-only state */
  }
}

let currentState: PetCareState | null = null;

export function getPetCareState(): PetCareState {
  if (!currentState) currentState = load();
  return currentState;
}

/** Advance decay for the elapsed wall-clock time and persist. */
export function tickPetCare(now = Date.now()): PetCareState {
  const st = getPetCareState();
  const dtMin = Math.max(0, Math.min(240, (now - st.updatedAt) / 60_000));
  if (dtMin > 0.05) {
    st.hunger = clamp(st.hunger + DECAY_PER_MIN.hunger * dtMin);
    st.thirst = clamp(st.thirst + DECAY_PER_MIN.thirst * dtMin);
    st.mood = clamp(st.mood - DECAY_PER_MIN.mood * dtMin);
    st.energy = clamp(st.energy - DECAY_PER_MIN.energy * dtMin);
    st.clean = clamp(st.clean - DECAY_PER_MIN.clean * dtMin);
    st.updatedAt = now;
    save(st);
  }
  return st;
}

export interface PetCareResult {
  state: PetCareState;
  /** Short toast text shown on the pet bubble. */
  feedback: string;
  /** True when the action actually helped (stat was not already maxed). */
  effective: boolean;
}

export function applyPetCareAction(action: PetCareAction, now = Date.now()): PetCareResult {
  // Decay first so a stale state catches up before the action applies.
  const st = tickPetCare(now);
  let effective = false;
  let feedback = '';
  switch (action) {
    case 'feed':
      if (st.hunger > 2) effective = true;
      st.hunger = clamp(st.hunger - 38);
      st.thirst = clamp(st.thirst + 4);
      st.mood = clamp(st.mood + 6);
      st.energy = clamp(st.energy + 6);
      feedback = effective ? '真好吃！谢谢投喂 🍖' : '已经吃得饱饱的啦…';
      break;
    case 'drink':
      if (st.thirst > 2) effective = true;
      st.thirst = clamp(st.thirst - 42);
      st.mood = clamp(st.mood + 4);
      feedback = effective ? '咕咚咕咚～补充水分 💧' : '还不渴，先放这儿吧';
      break;
    case 'play':
      effective = st.energy > 12;
      st.mood = clamp(st.mood + 26);
      st.energy = clamp(st.energy - 18);
      st.hunger = clamp(st.hunger + 8);
      st.thirst = clamp(st.thirst + 7);
      st.clean = clamp(st.clean - 10);
      feedback = effective ? '太好玩啦！再来一次！🎾' : '跑不动了…让我歇一会儿';
      break;
    case 'bath':
      if (st.clean < 96) effective = true;
      st.clean = clamp(st.clean + 48);
      st.mood = clamp(st.mood + 6);
      feedback = effective ? '洗得香香的，干净又漂亮 🛁' : '本来就很干净嘛';
      break;
  }
  st.updatedAt = now;
  save(st);
  return { state: st, feedback, effective };
}

/** One actionable "the pet needs something" item. */
export interface PetCareNeed {
  action: PetCareAction;
  icon: string;
  /** What the pet says in the reminder. */
  text: string;
  /** Label of the one-tap fix button. */
  actionLabel: string;
  urgent: boolean;
  /** 0..100, larger = more neglected. */
  severity: number;
}

interface NeedRule {
  action: PetCareAction;
  icon: string;
  actionLabel: string;
  warnText: string;
  urgentText: string;
  /** Neglect severity (0..100), or null when this need is not active. */
  severity: (s: PetCareState) => number | null;
  urgentAt: number;
}

/** Thresholds are deliberately earlier than the old "critical" ones so the pet
 *  speaks up while the user can still do something about it. */
const NEED_RULES: readonly NeedRule[] = [
  {
    action: 'feed',
    icon: '🍖',
    actionLabel: '立即喂食',
    warnText: '有点饿了，想吃东西 🍖',
    urgentText: '肚子咕咕叫了，快喂我吃饭 🍖',
    severity: (s) => (s.hunger >= 55 ? s.hunger : null),
    urgentAt: 82,
  },
  {
    action: 'drink',
    icon: '💧',
    actionLabel: '立即喝水',
    warnText: '有点渴了，想喝水 💧',
    urgentText: '好渴啊，快给我水喝 💧',
    severity: (s) => (s.thirst >= 55 ? s.thirst : null),
    urgentAt: 85,
  },
  {
    action: 'bath',
    icon: '🛁',
    actionLabel: '立即洗澡',
    warnText: '身上有点脏，想洗澡 🛁',
    urgentText: '身上痒痒的，快帮我洗个澡 🛁',
    severity: (s) => (s.clean <= 45 ? 100 - s.clean : null),
    urgentAt: 78, // clean <= 22
  },
  {
    action: 'play',
    icon: '🎾',
    actionLabel: '陪我玩耍',
    warnText: '有点无聊，想玩一会儿 🎾',
    urgentText: '好无聊啊，陪我玩会儿吧 🎾',
    severity: (s) => (s.mood <= 45 ? 100 - s.mood : null),
    urgentAt: 75, // mood <= 25
  },
];

/** All current care needs, most urgent first. */
export function petCareNeeds(state: PetCareState): PetCareNeed[] {
  const needs: PetCareNeed[] = [];
  for (const rule of NEED_RULES) {
    const severity = rule.severity(state);
    if (severity === null) continue;
    const urgent = severity >= rule.urgentAt;
    needs.push({
      action: rule.action,
      icon: rule.icon,
      actionLabel: rule.actionLabel,
      text: urgent ? rule.urgentText : rule.warnText,
      urgent,
      severity,
    });
  }
  needs.sort(
    (a, b) => Number(b.urgent) - Number(a.urgent) || b.severity - a.severity,
  );
  return needs;
}

/** Top-most warning text, or null when nothing needs attention.
 *  Kept for the standalone menu window's "needs care" hint. */
export function petCareWarning(state: PetCareState): string | null {
  const needs = petCareNeeds(state);
  return needs.length ? needs[0].text : null;
}
