import './style.css';
import './desktopPetTheme.css';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  DEFAULT_TAIL_KEY_IDS,
  KuroCatEngine,
  type KeyboardOrientation,
  type PeekEdge,
  type TailKeyMode,
} from './catEngine';
import { catAudio } from './audio';
import { AgentCompanionController, type AgentCompanionEvent } from './agentCompanion';
import {
  CompanionFeatures,
  type CompanionAction,
  type CompanionFlags,
} from './companionFeatures';
import {
  applyPetCareAction,
  getPetCareState,
  petCareNeeds,
  petCareWarning,
  tickPetCare,
  type PetCareAction,
  type PetCareState,
} from './petCare';
import { isIndependentSpecies, type PetMood } from './speciesRenderer2d';
import { DEFAULT_BUILTIN_CATS, resolveSpecies, type CatSkinConfig } from './catSkins';
import {
  getKeyboardLayout,
  normalizeKeyboardTheme,
  resolveKeyByVk,
  type KeyboardLayoutDef,
  type KeyboardLayoutId,
  type KeyboardThemeId,
  type KeySpec,
} from './keyboardLayout';
import type { CollarColorId, KuroCatEngine3D } from './catEngine3d';
import {
  applyDomTranslations,
  isMacPlatform,
  isWindowsPlatform,
  localizeBreedName,
  normalizeLanguageSetting,
  setActiveLocale,
  t,
} from './i18n';

type DesktopRenderMode = '2d' | '3d';
type HeadphoneMode = 'auto' | 'on' | 'off';

interface AppSettings {
  x: number | null;
  y: number | null;
  scale: number;
  opacity?: number;
  alwaysOnTop: boolean;
  clickThroughLocked: boolean;
  showKeyBubbles: boolean;
  soundEnabled: boolean;
  typingSoundEnabled?: boolean;
  autostart: boolean;
  catBreed: string;
  mcpEnabled: boolean;
  mcpPort: number;
  keyboardLayout: KeyboardLayoutId;
  keyboardOrientation: KeyboardOrientation;
  keyboardTheme?: KeyboardThemeId;
  privacyPasswordGuard: boolean;
  tailKeyMode: TailKeyMode;
  tailKeyIds: string[];
  obsEnabled?: boolean;
  obsPort?: number;
  obsHidePet?: boolean;
  liveCaptureEnabled?: boolean;
  liveChromaColor?: 'blue' | 'green' | 'magenta';
  liveHidePet?: boolean;
  renderMode?: DesktopRenderMode;
  collarColor?: CollarColorId;
  headphoneMode?: HeadphoneMode;
  fpsCap?: number;
  language?: string;
  companionBond?: boolean;
  companionAmbient?: boolean;
  companionProactive?: boolean;
  companionTypingSemantics?: boolean;
}

type InputEvent =
  | { kind: 'keyDown'; vk: number; scan: number; repeat: boolean }
  | { kind: 'keyUp'; vk: number; scan: number }
  | { kind: 'mouseDown'; button: string }
  | { kind: 'mouseUp'; button: string }
  | { kind: 'mouseWheel'; delta: number }
  | { kind: 'mouseMove'; x: number; y: number; nx: number; ny: number }
  | { kind: 'privacyTyping' };

interface WindowCursorInfo {
  relX: number;
  relY: number;
  insideWindow: boolean;
  overCat: boolean;
  altOverride?: boolean;
}

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
  assetName: string | null;
  downloadUrl: string | null;
  assetSha256: string | null;
  assetSize: number | null;
  installKind: string;
  notesSummary: string;
  /** True when the REST API was blocked and we fell back to Atom / local info. */
  checkDegraded?: boolean;
}

interface UpdateProgressEvent {
  stage: string;
  message: string;
  info: UpdateInfo | null;
}

const DISMISSED_UPDATE_STORAGE_KEY = 'kurocat_dismissed_update_version';
const DESKTOPPET_RELEASES_PAGE = 'https://github.com/daxian942-tech/DesktopPet/releases/latest';

function loadDismissedVersion(): string | null {
  try {
    const saved = window.localStorage.getItem(DISMISSED_UPDATE_STORAGE_KEY);
    return saved && saved.trim() ? saved.trim() : null;
  } catch {
    return null;
  }
}

function saveDismissedVersion(version: string): void {
  try {
    window.localStorage.setItem(DISMISSED_UPDATE_STORAGE_KEY, version);
  } catch {
    // Ignore storage quota/sandbox errors
  }
}

let appVersion = '1.0.3';
let latestUpdateInfo: UpdateInfo | null = null;
let updateBusy = false;
let dismissedVersion: string | null = loadDismissedVersion();
let currentToastKind: 'update' | 'admin' | 'transient' | null = null;
let toastAutoHideTimer: number | null = null;
const ADMIN_HINT_DISMISSED_KEY = 'kurocat_admin_game_hint_dismissed';
let adminHintShownThisSession = false;
let sliderDragging = false;
let opacitySliderDragging = false;
let altOverride = false;
let lastKnownLockState: boolean | null = null;
let syncWin7OverlayFn: ((focusMenu?: boolean) => void) | null = null;
let tailPickerOpen = false;
let tailPickerLoading = false;
let tailPickerSaving = false;
let tailPickerSelection = new Set<string>();
let tailPickerStatusOverride: string | null = null;
let resolvedBackendLocale: string | null = null;
const ARROW_KEY_IDS = new Set(['up', 'down', 'left', 'right']);

let settings: AppSettings = {
  x: null,
  y: null,
  scale: 1,
  opacity: 1,
  alwaysOnTop: true,
  clickThroughLocked: false,
  showKeyBubbles: true,
  soundEnabled: true,
  typingSoundEnabled: false,
  autostart: false,
  catBreed: 'black',
  mcpEnabled: true,
  mcpPort: 27420,
  keyboardLayout: '65',
  keyboardOrientation: 'cat',
  keyboardTheme: 'oat',
  privacyPasswordGuard: true,
  tailKeyMode: 'smart',
  tailKeyIds: [...DEFAULT_TAIL_KEY_IDS],
  liveCaptureEnabled: false,
  liveChromaColor: 'blue',
  liveHidePet: false,
  renderMode: '3d',
  collarColor: 'none',
  headphoneMode: 'off',
  fpsCap: 0,
  language: 'auto',
  companionBond: true,
  companionAmbient: true,
  companionProactive: false,
  companionTypingSemantics: false,
};

let catList: CatSkinConfig[] = [...DEFAULT_BUILTIN_CATS];

const canvas = document.getElementById('pet-canvas') as HTMLCanvasElement;
let canvas3d = document.getElementById('pet-canvas-3d') as HTMLCanvasElement;
let canvas3dMouseDownListener: ((e: MouseEvent) => void) | null = null;
let canvas3dContextMenuListener: ((e: MouseEvent) => void) | null = null;
let canvas3dDblClickListener: (() => void) | null = null;
let canvas3dDirty = false;
let settingsPatchSeq = 0;
const menuEl = document.getElementById('context-menu') as HTMLDivElement;
const breedPillsEl = document.getElementById('breed-pills') as HTMLDivElement;
const scaleSliderEl = document.getElementById('scale-slider') as HTMLInputElement;
const scaleValueEl = document.getElementById('scale-value') as HTMLButtonElement;
const opacitySliderEl = document.getElementById('opacity-slider') as HTMLInputElement | null;
const opacityValueEl = document.getElementById('opacity-value') as HTMLButtonElement | null;
const updateToastEl = document.getElementById('update-toast') as HTMLDivElement;
const updateToastTextEl = document.getElementById('update-toast-text') as HTMLSpanElement;
const btnToastInstallEl = document.getElementById('btn-toast-install') as HTMLButtonElement;
const btnToastUnlockEl = document.getElementById('btn-toast-unlock') as HTMLButtonElement;
const btnToastAdminEl = document.getElementById('btn-toast-admin') as HTMLButtonElement | null;
const btnToastOpenEl = document.getElementById('btn-toast-open') as HTMLButtonElement;
const btnToastCloseEl = document.getElementById('btn-toast-close') as HTMLButtonElement;
const tailPickerBarEl = document.getElementById('tail-picker-bar') as HTMLDivElement;
const tailPickerTitleEl = document.getElementById('tail-picker-title') as HTMLSpanElement;
const tailPresetButtons = tailPickerBarEl.querySelectorAll<HTMLButtonElement>('.tail-picker-presets [data-tailpreset]');
const btnTailDoneEl = document.getElementById('btn-tail-done') as HTMLButtonElement;
const btnTailCancelEl = document.getElementById('btn-tail-cancel') as HTMLButtonElement;
const tailModeBadgeEl = document.getElementById('tail-mode-badge') as HTMLSpanElement;
const tailKeysCountEl = document.getElementById('tail-keys-count') as HTMLSpanElement;
const agentBubbleEl = document.getElementById('agent-bubble') as HTMLDivElement | null;
const careQuickbarEl = document.getElementById('care-quickbar') as HTMLDivElement | null;
const engine = new KuroCatEngine(canvas);
engine.onDeepSleep = () => {
  void invoke('trim_idle_memory').catch(() => {});
};

// Lazy-loaded Three.js 3D engine (NEVER imported when user stays in 2D mode -> +0 MB overhead!)
let engine3d: KuroCatEngine3D | null = null;
let loading3dPromise: Promise<void> | null = null;
let dispose3dTimer: number | null = null;
const IDLE_3D_DISPOSE_MS = 8000;
let webgl3dUnavailable = false;
let isWin7Ulw = false;
let active3d = false;
let privacyActive = false;
let gameActive = false;

const agentCompanion = new AgentCompanionController({
  bubbleEl: agentBubbleEl,
  getTarget: () => (active3d && engine3d ? engine3d : engine),
  is3DTarget: () => Boolean(active3d && engine3d),
  allowSound: () => settings.soundEnabled !== false,
});

/* ---------------- Companion features: bond / ambient / proactive / typing ---------------- */
/** Rolling buffer of recently typed characters for opt-in semantics. */
let typingBuffer = '';

/** Best-effort VK -> printable char. Chinese IME text never reaches here;
 *  only ASCII is mapped, which is enough for the small keyword set. */
function vkToChar(vk: number): string {
  if (vk >= 0x41 && vk <= 0x5a) return String.fromCharCode(vk + 32);
  if (vk >= 0x30 && vk <= 0x39) return String.fromCharCode(vk);
  if (vk === 0x20) return ' ';
  return '';
}

const companion = new CompanionFeatures({
  say: (text, ttlMs) => agentCompanion.handleEvent({ kind: 'bubble', source: 'companion', text, ttlMs }),
  act: (action) => companionAct(action),
  speciesId: () => engine.customSkin?.id ?? 'black',
  isPrivate: () => privacyActive || gameActive,
  isFocused: () => gameActive,
  flags: (): CompanionFlags => ({
    bond: settings.companionBond !== false,
    ambient: settings.companionAmbient !== false,
    proactive: settings.companionProactive === true,
    typingSemantics: settings.companionTypingSemantics === true,
  }),
});

/** Map a generic companion action onto both engines (cat demos vs non-cat moods).
 *  Non-cat moods only exist for care expressions; the generic happy/curious
 *  states reuse 'play'/'idle' so they stay inside the supported PetMood union. */
function companionAct(action: CompanionAction): void {
  const target = active3d && engine3d ? engine3d : engine;
  const dur = 2600;
  switch (action) {
    case 'happy':
      if (active3d && engine3d) engine3d.triggerHappyDemo?.(dur);
      else engine.triggerHappyDemo?.(dur);
      break;
    case 'curious':
      target.triggerCuriousDemo(dur);
      break;
    case 'sleep':
      target.triggerSleepDemo();
      break;
    case 'wake':
      if (active3d && engine3d) engine3d.triggerWakeDemo?.();
      else engine.triggerWakeDemo?.();
      break;
    case 'angry':
      target.triggerCrossDemo();
      break;
    case 'pat':
      if (isIndependentSpecies(engine.customSkin)) {
        engine.triggerCareMood('happy', 2.4);
        engine3d?.triggerCareMood('happy', 2.4);
      } else {
        if (active3d && engine3d) engine3d.triggerHappyDemo?.(dur);
        else engine.triggerHappyDemo?.(dur);
      }
      break;
  }
}

/* ---------------- Pet care: feed / drink / play / bath ---------------- */
const PET_CARE_MOODS: Record<PetCareAction, PetMood> = {
  feed: 'eat',
  drink: 'drink',
  play: 'play',
  bath: 'bath',
};
const isPetCareAction = (v: string): v is PetCareAction =>
  v === 'feed' || v === 'drink' || v === 'play' || v === 'bath';
let lastCareWarnAt = 0;
let lastCareNeedKey = '';
let careQuickbarOpen = false;
let careQuickbarTimer: number | null = null;
let careQuickbarLeaveTimer: number | null = null;
let careQuickbarHover = false;
let careQuickbarAnchorX: number | null = null;
let careQuickbarAnchorY: number | null = null;

/** Register the quick-bar rect with the Rust hit-test loop so the transparent
 *  window stays clickable over it (same mechanism as the tail picker). */
function syncCareQuickbarBounds(): void {
  if (!careQuickbarEl) return;
  if (!careQuickbarOpen) {
    void invoke('set_care_popover_bounds', { bounds: null }).catch(() => {});
    return;
  }
  // Use layout offsets instead of getBoundingClientRect(): the open animation
  // temporarily scales the bar, which would make the Rust hit-test region too
  // small for the first ~180ms.
  const left = careQuickbarEl.offsetLeft;
  const top = careQuickbarEl.offsetTop;
  const right = left + careQuickbarEl.offsetWidth;
  const bottom = top + careQuickbarEl.offsetHeight;
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  // Pad enough for hover rings and the little pointer triangle.
  const pad = careQuickbarEl.classList.contains('care-quickbar--micro') ? 5 : 8;
  const clamp = (v: number): number => Math.max(0, Math.min(1, v));
  const bounds = [
    clamp((left - pad) / w), clamp((top - pad) / h),
    clamp((right + pad) / w), clamp((bottom + pad) / h),
  ];
  void invoke('set_care_popover_bounds', { bounds }).catch(() => {});
}

/** Highlight the neediest action so the user knows which button to tap. */
function renderCareQuickbar(state: PetCareState): void {
  const top = petCareNeeds(state)[0] ?? null;
  careQuickbarEl?.querySelectorAll<HTMLButtonElement>('[data-care-action]').forEach((btn) => {
    btn.classList.toggle('is-recommended', Boolean(top) && btn.dataset.careAction === top?.action);
  });
}

/** Adapt the quick bar to tiny pet windows before measuring/positioning it. */
function updateCareQuickbarLayout(): void {
  if (!careQuickbarEl) return;
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  // 20%-30% scales can produce a 100x100 logical window. A single row cannot
  // fit there, so fall back to a 2x2 icon grid; 40%-60% uses a tighter row.
  const micro = vw < 210 || vh < 110;
  careQuickbarEl.classList.toggle('care-quickbar--micro', micro);
  careQuickbarEl.classList.toggle('care-quickbar--compact', !micro && (vw < 270 || vh < 120));
}

/** Position the four buttons without letting them leave the tiny pet window. */
function placeCareQuickbar(clientX?: number, clientY?: number): void {
  if (!careQuickbarEl) return;
  updateCareQuickbarLayout();
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  const w = careQuickbarEl.offsetWidth || 100;
  const h = careQuickbarEl.offsetHeight || 54;
  const margin = 5;
  const cx = Math.max(0, Math.min(vw, clientX ?? vw / 2));
  const cy = Math.max(0, Math.min(vh, clientY ?? vh * 0.55));
  const maxLeft = Math.max(margin, vw - w - margin);
  const maxTop = Math.max(margin, vh - h - margin);
  const left = Math.max(margin, Math.min(maxLeft, cx - w / 2));
  // In micro mode the bar itself is compact enough to dock at the top, which
  // keeps it fully visible instead of clamping it over the tiny cat's face.
  const top = careQuickbarEl.classList.contains('care-quickbar--micro')
    ? margin
    : Math.max(margin, Math.min(maxTop, cy - h - 20));
  careQuickbarEl.style.left = `${Math.round(left)}px`;
  careQuickbarEl.style.top = `${Math.round(top)}px`;
}

/** Cancel a pending "mouse left the pet" hide. */
function cancelCareQuickbarLeave(): void {
  if (careQuickbarLeaveTimer !== null) {
    window.clearTimeout(careQuickbarLeaveTimer);
    careQuickbarLeaveTimer = null;
  }
}

/** Hide the bar shortly after the cursor leaves both the pet and the bar.
 *  The short grace period covers the gap between the pet and the floating bar. */
function scheduleCareQuickbarLeave(): void {
  if (!careQuickbarOpen || careQuickbarHover) return;
  if (careQuickbarLeaveTimer !== null) return;
  careQuickbarLeaveTimer = window.setTimeout(() => {
    careQuickbarLeaveTimer = null;
    if (!careQuickbarHover) closeCareQuickbar();
  }, 480);
}

function scheduleCareQuickbarAutoHide(): void {
  if (careQuickbarTimer !== null) window.clearTimeout(careQuickbarTimer);
  // Stay available long enough to tap, then get out of the way so it never
  // covers the pet permanently. Tapping the pet again brings it straight back.
  careQuickbarTimer = window.setTimeout(() => closeCareQuickbar(), 9000);
}

function openCareQuickbar(clientX?: number, clientY?: number): void {
  if (!careQuickbarEl || settings.clickThroughLocked) return;
  cancelCareQuickbarLeave();
  careQuickbarAnchorX = typeof clientX === 'number' && Number.isFinite(clientX) ? clientX : null;
  careQuickbarAnchorY = typeof clientY === 'number' && Number.isFinite(clientY) ? clientY : null;
  careQuickbarOpen = true;
  careQuickbarEl.classList.remove('hidden');
  placeCareQuickbar(careQuickbarAnchorX ?? undefined, careQuickbarAnchorY ?? undefined);
  renderCareQuickbar(getPetCareState());
  syncCareQuickbarBounds();
  requestAnimationFrame(() => syncWin7OverlayFn?.(false));
  scheduleCareQuickbarAutoHide();
}

function closeCareQuickbar(): void {
  cancelCareQuickbarLeave();
  if (!careQuickbarOpen) return;
  careQuickbarOpen = false;
  careQuickbarHover = false;
  careQuickbarAnchorX = null;
  careQuickbarAnchorY = null;
  if (careQuickbarTimer !== null) {
    window.clearTimeout(careQuickbarTimer);
    careQuickbarTimer = null;
  }
  careQuickbarEl?.classList.add('hidden');
  syncCareQuickbarBounds();
  requestAnimationFrame(() => syncWin7OverlayFn?.(false));
}

// 提醒气泡的关闭按钮
document.getElementById('ra-close')?.addEventListener('click', (e) => {
  e.stopPropagation();
  hideReminderAlert();
});

// Hovering the bar itself must not close it - the cursor has to leave the
// animal to reach the buttons, so treat both surfaces as one hover region.
careQuickbarEl?.addEventListener('mouseenter', () => {
  careQuickbarHover = true;
  cancelCareQuickbarLeave();
  scheduleCareQuickbarAutoHide();
});
careQuickbarEl?.addEventListener('mouseleave', () => {
  careQuickbarHover = false;
  scheduleCareQuickbarLeave();
  scheduleCareQuickbarAutoHide();
});
careQuickbarEl?.addEventListener('mousedown', (e) => e.stopPropagation());
careQuickbarEl?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-care-action]');
  if (!btn) return;
  e.stopPropagation();
  const action = btn.dataset.careAction ?? '';
  if (isPetCareAction(action)) performPetCareAction(action);
  // keep the bar open after a tap so users can chain actions, but restart the timer
  scheduleCareQuickbarAutoHide();
});
// The entrance animation scales the bar; re-sync the clickable rect once it settles.
careQuickbarEl?.addEventListener('animationend', (e) => {
  if (e.target !== careQuickbarEl || !careQuickbarOpen) return;
  syncCareQuickbarBounds();
  requestAnimationFrame(() => syncWin7OverlayFn?.(false));
});

function updatePetCareUI(state: PetCareState): void {
  const setBar = (id: string, val: number, invert = false): void => {
    const el = document.getElementById('pc-' + id);
    if (!el) return;
    const v = invert ? 100 - val : val;
    el.style.width = Math.max(3, v).toFixed(0) + '%';
    el.classList.toggle('pc-bad', v <= 22);
    el.classList.toggle('pc-warn', v > 22 && v <= 45);
  };
  setBar('hunger', state.hunger, true);
  setBar('thirst', state.thirst, true);
  setBar('mood', state.mood);
  setBar('energy', state.energy);
  setBar('clean', state.clean);
  const hint = document.getElementById('pet-care-hint');
  if (hint) hint.textContent = petCareWarning(state) ? '需要照顾！' : '状态良好';
}

function performPetCareAction(action: PetCareAction): void {
  const res = applyPetCareAction(action);
  if (res.effective) companion.recordInteraction(action);
  updatePetCareUI(res.state);
  // 猫和非猫都触发同一套照顾情绪：非猫由物种绘制器表达，
  // 猫由引擎层的碗 / 水场景表达，四个动作都有可见反馈。
  const mood = PET_CARE_MOODS[action];
  const duration = res.effective ? 2.2 : 1.0;
  engine.triggerCareMood(mood, duration);
  engine3d?.triggerCareMood(mood, duration);
  // 每个物种有自己的叫声和吃相动作；声音只在设置开启时响。
  if (settings.soundEnabled !== false && res.effective) {
    const species = engine.customSkin?.species ?? 'cat';
    catAudio.playCreatureVoice(species, action);
  }
  agentCompanion.handleEvent({
    kind: res.effective ? 'action' : 'bubble',
    action: 'happy',
    source: 'pet-care',
    text: res.feedback,
    ttlMs: 3200,
  });
  void emit('kuro-pet-care-state', res.state).catch(() => {});
  renderCareQuickbar(res.state);
  // A newly appeared need may speak up right away after the user finishes this action.
  lastCareWarnAt = 0;
  lastCareNeedKey = '';
}

/* ---------------- 提醒到点的大字气泡 ---------------- */
let reminderHideTimer: number | null = null;

function showReminderAlert(text: string, time: string): void {
  const el = document.getElementById('reminder-alert');
  const textEl = document.getElementById('ra-text');
  const timeEl = document.getElementById('ra-time');
  if (!el || !textEl || !timeEl) return;

  textEl.textContent = text;
  timeEl.textContent = time || '';
  timeEl.style.display = time ? '' : 'none';

  el.classList.remove('hidden', 'is-out');
  // 重放进入动画
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';

  // 到点叫一声（走当前物种的叫声）
  if (settings.soundEnabled !== false) {
    const species = engine.customSkin?.species ?? 'cat';
    catAudio.playCreatureVoice(species, 'play');
  }

  // 让桌宠做个"被惊醒"的动作，读起来像它来叫你
  if (isIndependentSpecies(engine.customSkin)) {
    engine.triggerCareMood('happy', 2.4);
    engine3d?.triggerCareMood('happy', 2.4);
  }

  if (reminderHideTimer !== null) window.clearTimeout(reminderHideTimer);
  reminderHideTimer = window.setTimeout(() => hideReminderAlert(), 12_000);
}

function hideReminderAlert(): void {
  const el = document.getElementById('reminder-alert');
  if (!el || el.classList.contains('hidden')) return;
  el.classList.add('is-out');
  if (reminderHideTimer !== null) {
    window.clearTimeout(reminderHideTimer);
    reminderHideTimer = null;
  }
  window.setTimeout(() => {
    el.classList.remove('is-out');
    el.classList.add('hidden');
  }, 300);
}

function startPetCareTicker(): void {  const tick = (): void => {
    const st = tickPetCare();
    updatePetCareUI(st);
    renderCareQuickbar(st);
    void emit('kuro-pet-care-state', st).catch(() => {});

    const needs = petCareNeeds(st);
    const top = needs[0] ?? null;
    const key = top ? `${top.action}:${top.urgent ? 1 : 0}` : '';
    const levelChanged = key !== lastCareNeedKey;
    lastCareNeedKey = key;
    if (!top) return;

    // Speak up as soon as a need appears or worsens, then stay quiet for a while.
    // No modal popover anymore: just a speech bubble, and if the quick bar is
    // already visible its matching button gently pulses to hint what to tap.
    const interval = top.urgent ? 3 * 60_000 : 10 * 60_000;
    if (!levelChanged && Date.now() - lastCareWarnAt <= interval) return;
    lastCareWarnAt = Date.now();
    agentCompanion.handleEvent({
      kind: 'bubble',
      source: 'pet-care',
      text: `${top.text} · 点头顶按钮 ${top.actionLabel}`,
      ttlMs: 6500,
    });
  };
  window.setTimeout(tick, 6_000);
  window.setInterval(tick, 30_000);
}
updatePetCareUI(getPetCareState());
startPetCareTicker();
companion.start();

window.addEventListener('resize', () => {
  engine3d?.resize();
  if (careQuickbarOpen) placeCareQuickbar();
  syncCareQuickbarBounds();
});

function bindCanvas3dListeners(el: HTMLCanvasElement): void {
  if (canvas3dMouseDownListener) {
    el.addEventListener('mousedown', canvas3dMouseDownListener);
  }
  if (canvas3dContextMenuListener) {
    el.addEventListener('contextmenu', canvas3dContextMenuListener);
  }
  if (canvas3dDblClickListener) {
    el.addEventListener('dblclick', canvas3dDblClickListener);
  }
  el.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault();
    if (el !== canvas3d) return;
    canvas3dDirty = true;
    if (engine3d) {
      const dead = engine3d;
      engine3d = null;
      dead.stop();
      if (active3d) {
        active3d = false;
        canvas3d.classList.add('hidden');
        canvas.classList.remove('hidden');
        engine.resize();
        engine.start();
      }
      window.setTimeout(() => {
        if (wants3DNow() && !engine3d && !loading3dPromise) {
          activateRenderEngine();
        }
      }, 300);
    }
  });
}

function replaceCanvas3d(): HTMLCanvasElement {
  const old = canvas3d;
  if (canvas3dMouseDownListener) {
    old.removeEventListener('mousedown', canvas3dMouseDownListener);
  }
  if (canvas3dContextMenuListener) {
    old.removeEventListener('contextmenu', canvas3dContextMenuListener);
  }
  if (canvas3dDblClickListener) {
    old.removeEventListener('dblclick', canvas3dDblClickListener);
  }
  const fresh = document.createElement('canvas');
  fresh.id = 'pet-canvas-3d';
  fresh.className = old.className;
  fresh.style.opacity = old.style.opacity;
  fresh.classList.remove('pet-hover', 'pet-dragging');
  old.replaceWith(fresh);
  canvas3d = fresh;
  canvas3dDirty = false;
  bindCanvas3dListeners(fresh);
  return fresh;
}

function disposeEngine3D(): void {
  if (!engine3d) return;
  const old = engine3d;
  engine3d = null;
  active3d = false;
  old.dispose();
  // Calling forceContextLoss() permanently loses the old <canvas>'s WebGL context per spec;
  // immediately swap in a brand-new <canvas id="pet-canvas-3d"> so switching back to 3D
  // always acquires a fresh WebGL2 context while the old canvas & GPU buffers are GC'd.
  replaceCanvas3d();
  canvas3d.classList.add('hidden');
}

function cancelPending3dDispose(): void {
  if (dispose3dTimer !== null) {
    window.clearTimeout(dispose3dTimer);
    dispose3dTimer = null;
  }
}

function schedule3dDisposeIf2D(): void {
  cancelPending3dDispose();
  if (!engine3d || active3d || tailPickerOpen || wants3DNow()) return;
  dispose3dTimer = window.setTimeout(() => {
    dispose3dTimer = null;
    if (engine3d && !active3d && !tailPickerOpen && !wants3DNow()) {
      disposeEngine3D();
      void invoke('trim_idle_memory').catch(() => {});
    }
  }, IDLE_3D_DISPOSE_MS);
}

function shouldWearHeadphonesNow(): boolean {
  if (settings.catBreed === 'dafeiyu') return false;
  const hm: HeadphoneMode =
    settings.headphoneMode === 'auto' || settings.headphoneMode === 'on'
      ? settings.headphoneMode
      : 'off';
  if (hm === 'on') return true;
  if (hm === 'off') return false;
  return gameActive;
}

function wants3DNow(): boolean {
  return (
    settings.renderMode !== '2d' &&
    settings.catBreed !== 'dafeiyu' &&
    !tailPickerOpen &&
    !isWin7Ulw &&
    !webgl3dUnavailable
  );
}

function syncEngine3DState(): void {
  if (!engine3d) return;
  const activeCat = catList.find((c) => c.id === settings.catBreed) ?? catList[0];
  const kbLayout: KeyboardLayoutId = settings.keyboardLayout === '108' ? '108' : '65';
  const kbOrient: KeyboardOrientation = settings.keyboardOrientation === 'viewer' ? 'viewer' : 'cat';
  const kbTheme = normalizeKeyboardTheme(settings.keyboardTheme);
  const tailMode: TailKeyMode =
    settings.tailKeyMode === 'custom' ||
    settings.tailKeyMode === 'edge' ||
    settings.tailKeyMode === 'off'
      ? settings.tailKeyMode
      : 'smart';
  const tailIds = Array.isArray(settings.tailKeyIds) ? settings.tailKeyIds : [...DEFAULT_TAIL_KEY_IDS];
  const collar: CollarColorId =
    settings.collarColor === 'red' ||
    settings.collarColor === 'blue' ||
    settings.collarColor === 'pink' ||
    settings.collarColor === 'green'
      ? settings.collarColor
      : 'none';

  engine3d.showKeyBubbles = settings.showKeyBubbles;
  engine3d.setRenderStyle('3d');
  if (activeCat) {
    engine3d.setCatSkin(activeCat);
  }
  engine3d.setCollar(collar);
  engine3d.setHeadphones(shouldWearHeadphonesNow());
  engine3d.setGameActive(gameActive);
  engine3d.setKeyboardTheme(kbTheme);
  engine3d.setKeyboardConfig(kbLayout, kbOrient);
  engine3d.setTailKeyConfig(tailMode, tailIds);
  engine3d.setPrivacyMode(privacyActive);
  engine3d.setFpsCap(settings.fpsCap === 30 ? 30 : 0);
  engine3d.setPeekEdge(engine.getPeekEdge());
  engine3d.resize();
}

function activateRenderEngine(): void {
  const want3d = wants3DNow();
  if (!want3d) {
    if (active3d) {
      engine3d?.stop();
      canvas3d.classList.add('hidden');
      canvas.classList.remove('hidden');
      engine.resize();
      engine.start();
      active3d = false;
    }
    schedule3dDisposeIf2D();
    return;
  }

  cancelPending3dDispose();

  if (engine3d && engine3d.isContextLost()) {
    disposeEngine3D();
  }

  if (engine3d) {
    syncEngine3DState();
    if (!active3d) {
      engine.stop();
      engine.releaseCachedResources();
      canvas.classList.add('hidden');
      canvas3d.classList.remove('hidden');
      engine3d.resize();
      engine3d.start();
      active3d = true;
    }
    return;
  }

  if (!loading3dPromise) {
    if (canvas3dDirty) {
      replaceCanvas3d();
    }
    loading3dPromise = import('./catEngine3d')
      .then(({ KuroCatEngine3D }) => {
        if (canvas3dDirty) {
          replaceCanvas3d();
        }
        const created = new KuroCatEngine3D(canvas3d, { embedded: false });
        if (created.isContextLost()) {
          created.dispose();
          replaceCanvas3d();
          throw new Error('WebGL context lost immediately after creation');
        }
        engine3d = created;
        engine3d.onDeepSleep = () => {
          void invoke('trim_idle_memory').catch(() => {});
        };
        activateRenderEngine();
      })
      .catch((err) => {
        console.warn('3D WebGL unavailable, keeping 2D mode:', err);
        webgl3dUnavailable = true;
        active3d = false;
        replaceCanvas3d();
        canvas3d.classList.add('hidden');
        canvas.classList.remove('hidden');
        engine.resize();
        engine.start();
      })
      .finally(() => {
        loading3dPromise = null;
      });
  }
}

function formatBreedPillLabel(cat: CatSkinConfig): string {
  const displayName = localizeBreedName(cat.id, cat.name, cat.builtin);
  if (cat.emoji) {
    return displayName.startsWith(cat.emoji) ? displayName : `${cat.emoji} ${displayName}`;
  }
  return `🐱 ${displayName}`;
}

function formatHeaderCatName(cat: CatSkinConfig): string {
  const emoji = cat.emoji || '🐱';
  const displayName = localizeBreedName(cat.id, cat.name, cat.builtin);
  const bareName =
    cat.emoji && displayName.startsWith(cat.emoji)
      ? displayName.slice(cat.emoji.length).trimStart()
      : displayName;
  void emoji;
  return `DesktopPet · ${bareName}`;
}

function renderBreedPills(): void {
  if (!breedPillsEl) return;
  breedPillsEl.innerHTML = '';
  for (const cat of catList) {
    const btn = document.createElement('button');
    btn.className = 'breed-pill';
    btn.dataset.breed = cat.id;
    const label = formatBreedPillLabel(cat);
    btn.textContent = label;
    btn.title = label;
    const accent = cat.accentColor || (cat.id === 'ragdoll' ? '#7ac7ff' : '#c8f538');
    btn.style.setProperty('--pill-accent', accent);
    btn.classList.toggle('active', cat.id === settings.catBreed);
    breedPillsEl.appendChild(btn);
  }
}

function updateScaleSliderVisual(scaleVal: number): void {
  const pctNum = Math.round(Math.max(20, Math.min(150, scaleVal * 100)));
  if (scaleSliderEl) {
    scaleSliderEl.value = String(pctNum);
    const fillPct = ((pctNum - 20) / (150 - 20)) * 100;
    scaleSliderEl.style.setProperty('--pct', `${fillPct.toFixed(1)}%`);
  }
  if (scaleValueEl) {
    scaleValueEl.textContent = `${pctNum}%`;
  }
}

function normalizeOpacity(opacityVal: number | undefined): number {
  if (typeof opacityVal !== 'number' || !Number.isFinite(opacityVal)) return 1;
  const normalized = opacityVal >= 10 && opacityVal <= 100 ? opacityVal / 100 : opacityVal;
  return Math.max(0.2, Math.min(1, normalized));
}

function updateOpacitySliderVisual(opacityVal: number | undefined): void {
  const pctNum = Math.round(normalizeOpacity(opacityVal) * 100);
  if (opacitySliderEl) {
    opacitySliderEl.value = String(pctNum);
    const fillPct = ((pctNum - 20) / (100 - 20)) * 100;
    opacitySliderEl.style.setProperty('--pct', `${fillPct.toFixed(1)}%`);
  }
  if (opacityValueEl) {
    opacityValueEl.textContent = `${pctNum}%`;
  }
}

function applyPetOpacity(opacityVal: number | undefined): void {
  const clamped = normalizeOpacity(opacityVal);
  // On Win7/8 ULW mode, transparency is composited natively via UpdateLayeredWindow
  // SourceConstantAlpha, so keep the offscreen 2D canvas opaque to preserve alpha precision.
  const cssOpacity = isWin7Ulw ? '1' : clamped.toFixed(3);
  canvas.style.opacity = cssOpacity;
  canvas3d.style.opacity = cssOpacity;
}

let adminStatus: { supported: boolean; elevated: boolean } = { supported: false, elevated: false };

function syncMenuUI(): void {
  setActiveLocale(settings.language, resolvedBackendLocale);
  applyDomTranslations();

  const btnRestartAdmin = document.getElementById('btn-restart-admin') as HTMLButtonElement | null;
  const adminRestartLabel = document.getElementById('admin-restart-label');
  const adminText = t(adminStatus.elevated ? 'menu.admin_ready' : 'menu.admin_restart');
  if (btnRestartAdmin) {
    btnRestartAdmin.classList.toggle('hidden', !adminStatus.supported);
    btnRestartAdmin.disabled = adminStatus.elevated;
  }
  if (adminRestartLabel) {
    adminRestartLabel.textContent = adminText;
  }

  const setCheck = (id: string, on: boolean) => {
    const el = document.getElementById(id);
    if (el) el.textContent = on ? '✓' : '';
  };
  setCheck('chk-privacy', settings.privacyPasswordGuard !== false);
  setCheck('chk-bubbles', settings.showKeyBubbles);
  setCheck('chk-lock', settings.clickThroughLocked);
  setCheck('chk-sound', settings.soundEnabled);
  setCheck('chk-typing-sound', Boolean(settings.typingSoundEnabled));
  setCheck('chk-top', settings.alwaysOnTop);
  setCheck('chk-autostart', settings.autostart);
  setCheck('chk-mcp', settings.mcpEnabled);

  if (!sliderDragging) {
    updateScaleSliderVisual(settings.scale);
  }
  if (!opacitySliderDragging) {
    updateOpacitySliderVisual(settings.opacity);
    applyPetOpacity(settings.opacity);
  }

  const kbLayout: KeyboardLayoutId = settings.keyboardLayout === '108' ? '108' : '65';
  const kbOrient: KeyboardOrientation = settings.keyboardOrientation === 'viewer' ? 'viewer' : 'cat';
  const tailMode: TailKeyMode =
    settings.tailKeyMode === 'custom' ||
    settings.tailKeyMode === 'edge' ||
    settings.tailKeyMode === 'off'
      ? settings.tailKeyMode
      : 'smart';
  const tailIds = Array.isArray(settings.tailKeyIds) ? settings.tailKeyIds : [...DEFAULT_TAIL_KEY_IDS];

  document.querySelectorAll<HTMLButtonElement>('[data-kblayout]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.kblayout === kbLayout);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-kborient]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.kborient === kbOrient);
  });
  const kbTheme = normalizeKeyboardTheme(settings.keyboardTheme);
  document.querySelectorAll<HTMLButtonElement>('[data-kbtheme]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.kbtheme === kbTheme);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-tailmode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tailmode === tailMode);
  });
  const fpsCapStr = settings.fpsCap === 30 ? '30' : '0';
  document.querySelectorAll<HTMLButtonElement>('[data-fpscap]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.fpscap === fpsCapStr);
  });
  const langSetting = normalizeLanguageSetting(settings.language);
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === langSetting);
  });
  if (tailModeBadgeEl) {
    tailModeBadgeEl.textContent = t(`menu.tail_badge_${tailMode}`);
  }
  if (tailKeysCountEl) {
    tailKeysCountEl.textContent = t('menu.tail_keys_count', { count: tailIds.length });
  }
  const activeCat = catList.find((c) => c.id === settings.catBreed) ?? catList[0];
  renderBreedPills();

  // 语音物种在这里统一设置一次：两个渲染引擎都会调各自的皮肤方法，
  // 若让它们各自 setSpecies，某一方拿到空皮肤时会把物种误重置成 cat，
  // 造成"切到牛了却还在响猫声"。这里用同源的 activeCat 判定，唯一真相。
  if (activeCat) {
    catAudio.setSpecies(resolveSpecies(activeCat.species));
  }

  const renderMode: DesktopRenderMode = settings.renderMode === '2d' ? '2d' : '3d';
  const collarColor: CollarColorId =
    settings.collarColor === 'red' ||
    settings.collarColor === 'blue' ||
    settings.collarColor === 'pink' ||
    settings.collarColor === 'green'
      ? settings.collarColor
      : 'none';
  document.querySelectorAll<HTMLButtonElement>('[data-rendermode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.rendermode === renderMode);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-collar]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.collar === collarColor);
  });
  const renderModeRowEl = document.getElementById('render-mode-row');
  if (renderModeRowEl) {
    renderModeRowEl.classList.toggle('hidden', settings.catBreed === 'dafeiyu');
  }
  const collarRowEl = document.getElementById('collar-row');
  if (collarRowEl) {
    collarRowEl.classList.toggle('hidden', renderMode === '2d' || settings.catBreed === 'dafeiyu');
  }

  const headphoneMode: HeadphoneMode =
    settings.headphoneMode === 'auto' || settings.headphoneMode === 'on'
      ? settings.headphoneMode
      : 'off';
  document.querySelectorAll<HTMLButtonElement>('[data-headphonemode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.headphonemode === headphoneMode);
  });
  const headphoneRowEl = document.getElementById('headphone-row');
  if (headphoneRowEl) {
    headphoneRowEl.classList.toggle('hidden', settings.catBreed === 'dafeiyu');
  }

  const headerEl = document.getElementById('menu-header');
  if (headerEl && activeCat) {
    headerEl.textContent = formatHeaderCatName(activeCat);
    headerEl.style.color = activeCat.accentColor || '#c8f538';
  }

  const updateLabelEl = document.getElementById('update-btn-label');
  if (updateLabelEl) {
    updateLabelEl.textContent = t('menu.check_update', { ver: appVersion }).replace(/\s*v[\d.]+$/i, '');
  }

  const fpsCapNum = settings.fpsCap === 30 ? 30 : 0;
  engine.showKeyBubbles = settings.showKeyBubbles;
  engine.setCatAppearance(activeCat?.id || 'black', activeCat);
  engine.setHeadphones(shouldWearHeadphonesNow());
  engine.setKeyboardConfig(kbLayout, kbOrient);
  engine.setTailKeyConfig(tailMode, tailIds);
  engine.setFpsCap(fpsCapNum);
  engine3d?.setFpsCap(fpsCapNum);
  if (!sliderDragging) {
    engine.setRenderScale(settings.scale);
  }
  catAudio.setEnabled(settings.soundEnabled);
  catAudio.setTypingSoundEnabled(Boolean(settings.typingSoundEnabled));
  activateRenderEngine();
  if (tailPickerOpen) syncTailPickerSelection();
}

function syncWindowInteractiveState(): void {
  const open = !menuEl.classList.contains('hidden');
  void invoke('set_menu_open', { open });
}

function syncTailPickerBounds(): void {
  if (!tailPickerOpen) {
    void invoke('set_tail_picker_bounds', { bounds: null });
    return;
  }

  const normalized = (rect: DOMRect) => [
    rect.left / window.innerWidth,
    rect.top / window.innerHeight,
    rect.right / window.innerWidth,
    rect.bottom / window.innerHeight,
  ];
  void invoke('set_tail_picker_bounds', {
    bounds: {
      toolbar: normalized(tailPickerBarEl.getBoundingClientRect()),
      keyboard: normalized(engine.getKeyboardClientBounds()),
      closeButton: normalized(btnTailCancelEl.getBoundingClientRect()),
    },
  });
}

function syncTailPickerSelection(): void {
  const layout = getKeyboardLayout(settings.keyboardLayout);
  const visibleCount = layout.keys.filter(({ id }) => tailPickerSelection.has(id)).length;
  tailPickerTitleEl.textContent =
    tailPickerStatusOverride ?? t('toast.tail_picker_hint', { count: visibleCount });
  for (const button of tailPresetButtons) {
    const presetKeys = getTailPresetKeys(button.dataset.tailpreset ?? '', layout);
    button.setAttribute('aria-pressed', String(isTailPresetSelected(presetKeys)));
  }
  engine.setTailPickerActive(true, tailPickerSelection);
  syncTailPickerBounds();
}

function closeContextMenu(): void {
  if (!menuEl.classList.contains('hidden')) {
    menuEl.classList.add('hidden');
    syncWindowInteractiveState();
    syncWin7OverlayFn?.(false);
  }
  void invoke('close_context_menu');
}

function openContextMenu(clientX: number, clientY: number): void {
  // Always pop the dedicated non-overlapping side menu window beside the cat so it NEVER blocks the pet!
  if (!menuEl.classList.contains('hidden')) {
    menuEl.classList.add('hidden');
    syncWindowInteractiveState();
    syncWin7OverlayFn?.(false);
  }
  void invoke('open_context_menu').catch(() => {
    // Defensive fallback to inline menu if side-window creation ever fails on an unsupported WM
    menuEl.classList.remove('hidden');
    const mw = menuEl.offsetWidth || 236;
    const mh = menuEl.offsetHeight || 360;
    const left = Math.max(8, Math.min(window.innerWidth - mw - 8, clientX));
    const top = Math.max(8, Math.min(window.innerHeight - mh - 8, clientY));
    menuEl.style.left = `${left}px`;
    menuEl.style.top = `${top}px`;
    syncWindowInteractiveState();
    syncWin7OverlayFn?.(true);
  });
}

async function openTailPicker(): Promise<void> {
  if (tailPickerOpen || tailPickerLoading) return;
  tailPickerLoading = true;
  try {
    settings = await invoke<AppSettings>('get_settings');
    tailPickerSelection = new Set(settings.tailKeyIds ?? DEFAULT_TAIL_KEY_IDS);
    tailPickerStatusOverride = null;
    tailPickerOpen = true;
    closeContextMenu();
    tailPickerBarEl.classList.remove('hidden');
    syncMenuUI();
    requestAnimationFrame(() => syncWin7OverlayFn?.(true));
  } catch (error) {
    console.error('加载自定义尾巴按键失败', error);
  } finally {
    tailPickerLoading = false;
  }
}

function closeTailPicker(): void {
  if (!tailPickerOpen || tailPickerSaving) return;
  tailPickerOpen = false;
  tailPickerStatusOverride = null;
  tailPickerSelection.clear();
  tailPickerBarEl.classList.add('hidden');
  canvas.classList.remove('tail-key-hover');
  engine.setTailPickerActive(false);
  syncTailPickerBounds();
  activateRenderEngine();
  syncWin7OverlayFn?.(false);
}

function toggleTailKeyId(specId: string): void {
  if (tailPickerSaving) return;
  if (!tailPickerSelection.delete(specId)) tailPickerSelection.add(specId);
  tailPickerStatusOverride = null;
  syncTailPickerSelection();
}

function getTailPresetKeys(presetKey: string, { keys, totalUnits, totalRows }: KeyboardLayoutDef): KeySpec[] {
  return keys.filter((key) => {
    switch (presetKey) {
      case 'office':
        return key.id === 'enter' || key.id === 'space';
      case 'rightFn':
        return ARROW_KEY_IDS.has(key.id) || key.id === 'numlk' || key.id.startsWith('np_');
      case 'edgeMods': {
        const top = key.rowY ?? key.row;
        const bottom = top + (key.rowSpan ?? 1);
        return key.uStart === 0 || key.uStart + key.uWidth >= totalUnits - 0.001 ||
          top === 0 || bottom >= totalRows - 0.001;
      }
      default:
        return false;
    }
  });
}

function isTailPresetSelected(keys: KeySpec[]): boolean {
  return keys.length > 0 && keys.every(({ id }) => tailPickerSelection.has(id));
}

function applyTailPreset(presetKey: string): void {
  if (tailPickerSaving) return;
  if (presetKey === 'clear') {
    tailPickerSelection.clear();
  } else {
    const presetKeys = getTailPresetKeys(presetKey, getKeyboardLayout(settings.keyboardLayout));
    if (isTailPresetSelected(presetKeys)) {
      for (const { id } of presetKeys) tailPickerSelection.delete(id);
    } else {
      for (const { id } of presetKeys) tailPickerSelection.add(id);
    }
  }
  tailPickerStatusOverride = null;
  syncTailPickerSelection();
}

async function confirmTailPicker(): Promise<void> {
  if (!tailPickerOpen || tailPickerSaving) return;
  tailPickerSaving = true;
  btnTailDoneEl.disabled = true;
  btnTailCancelEl.disabled = true;
  try {
    settings = await invoke<AppSettings>('save_tail_picker_selection', {
      keyIds: [...tailPickerSelection],
    });
  } catch (error) {
    console.error('保存自定义尾巴按键失败', error);
    tailPickerStatusOverride = '保存失败，请重试';
    syncTailPickerSelection();
    return;
  } finally {
    tailPickerSaving = false;
    btnTailDoneEl.disabled = false;
    btnTailCancelEl.disabled = false;
  }
  closeTailPicker();
  syncMenuUI();
}

async function applySettingsPatch(patch: Partial<AppSettings>): Promise<void> {
  if (patch.renderMode === '3d') {
    webgl3dUnavailable = false;
  }
  const seq = ++settingsPatchSeq;
  settings = { ...settings, ...patch };
  syncMenuUI();
  const updated = await invoke<AppSettings>('update_settings', { patch: settings });
  if (seq !== settingsPatchSeq) return;
  settings = updated;
  syncMenuUI();
}

async function copyMcpConfig(): Promise<void> {
  const hint = document.getElementById('mcp-copy-hint');
  try {
    const jsonText = await invoke<string>('get_mcp_config');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(jsonText);
    } else {
      const ta = document.createElement('textarea');
      ta.value = jsonText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (hint) {
      hint.textContent = t('menu.copied_hint');
      hint.classList.add('copied');
      setTimeout(() => {
        hint.textContent = t('menu.mcp_hint');
        hint.classList.remove('copied');
      }, 1800);
    }
  } catch (err) {
    console.error('Failed to copy MCP config:', err);
  }
}

async function copyAgentHooksConfig(): Promise<void> {
  const hint = document.getElementById('hooks-copy-hint');
  try {
    const jsonText = await invoke<string>('get_agent_hooks_config');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(jsonText);
    } else {
      const ta = document.createElement('textarea');
      ta.value = jsonText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (hint) {
      hint.textContent = t('menu.copied_hint');
      hint.classList.add('copied');
      setTimeout(() => {
        hint.textContent = t('menu.hooks_hint');
        hint.classList.remove('copied');
      }, 1800);
    }
  } catch (err) {
    console.error('Failed to copy Agent hooks config:', err);
  }
}

async function createDesktopShortcut(): Promise<void> {
  const hint = document.getElementById('shortcut-hint');
  try {
    await invoke<string>('create_desktop_shortcut');
    if (hint) {
      hint.textContent = t('menu.created_hint');
      hint.classList.add('copied');
      setTimeout(() => {
        hint.textContent = 'DesktopPet';
        hint.classList.remove('copied');
      }, 1800);
    }
  } catch (err) {
    console.error('Failed to create desktop shortcut:', err);
  }
}

function setUpdateHint(text: string, mode: 'default' | 'ready' | 'error' = 'default'): void {
  const hint = document.getElementById('update-hint');
  if (!hint) return;
  hint.textContent = text;
  hint.classList.remove('update-ready', 'update-error');
  if (mode === 'ready') hint.classList.add('update-ready');
  else if (mode === 'error') hint.classList.add('update-error');
}

function formatAvailableUpdateText(ver: string): string {
  return window.innerWidth < 250 ? `⬆ v${ver}` : `✨ ${t('toast.available', { ver })}`;
}

function formatLockedToastText(_startup = false): string {
  if (window.innerWidth < 260) {
    return '🔒';
  }
  return isMacPlatform() ? `🔒 ${t('toast.locked_macos')}` : `🔒 ${t('toast.locked_windows')}`;
}

function formatAdminGameToastText(): string {
  if (window.innerWidth < 260) {
    return '🛡️';
  }
  return `🛡️ ${t('toast.game_admin_hint')}`;
}

function isAdminHintDismissed(): boolean {
  try {
    return window.localStorage.getItem(ADMIN_HINT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function saveAdminHintDismissed(): void {
  try {
    window.localStorage.setItem(ADMIN_HINT_DISMISSED_KEY, '1');
  } catch {
    // ignore storage errors
  }
}

function showPendingUpdateToast(): boolean {
  if (
    updateBusy ||
    !latestUpdateInfo?.hasUpdate ||
    dismissedVersion === latestUpdateInfo.latestVersion
  ) {
    return false;
  }
  showUpdateToast(formatAvailableUpdateText(latestUpdateInfo.latestVersion), {
    showInstall: Boolean(latestUpdateInfo.downloadUrl),
    showOpen: !latestUpdateInfo.downloadUrl,
    kind: 'update',
  });
  return true;
}

function hideUpdateToast(restorePendingUpdate = false): void {
  if (toastAutoHideTimer !== null) {
    window.clearTimeout(toastAutoHideTimer);
    toastAutoHideTimer = null;
  }
  const prevKind = currentToastKind;
  currentToastKind = null;
  if (restorePendingUpdate && (prevKind === 'transient' || prevKind === 'admin') && showPendingUpdateToast()) {
    return;
  }
  if (!updateToastEl.classList.contains('hidden')) {
    updateToastEl.classList.add('hidden');
    void invoke('set_update_banner_open', { open: false });
    syncWin7OverlayFn?.(false);
  }
}

function showUpdateToast(
  text: string,
  options: {
    showInstall?: boolean;
    showUnlock?: boolean;
    showAdmin?: boolean;
    showOpen?: boolean;
    autoHideMs?: number;
    busy?: boolean;
    kind?: 'update' | 'admin' | 'transient';
  } = {},
): void {
  if (toastAutoHideTimer !== null) {
    window.clearTimeout(toastAutoHideTimer);
    toastAutoHideTimer = null;
  }
  currentToastKind = options.kind ?? 'transient';
  updateToastTextEl.textContent = text;
  btnToastInstallEl.classList.toggle('hidden', !options.showInstall);
  btnToastInstallEl.disabled = Boolean(options.busy);
  btnToastUnlockEl.classList.toggle('hidden', !options.showUnlock);
  btnToastAdminEl?.classList.toggle('hidden', !options.showAdmin);
  btnToastOpenEl.classList.toggle('hidden', !options.showOpen);
  updateToastEl.classList.remove('hidden');
  void invoke('set_update_banner_open', { open: true });
  requestAnimationFrame(() => syncWin7OverlayFn?.(false));

  if (options.autoHideMs && options.autoHideMs > 0) {
    toastAutoHideTimer = window.setTimeout(() => {
      hideUpdateToast(true);
    }, options.autoHideMs);
  }
}

function handleUpdateProgressEvent(ev: UpdateProgressEvent, fromManual = false): void {
  if (ev.info) {
    latestUpdateInfo = ev.info;
    // The footer must always show the LOCAL version from Cargo.toml. The update
    // payload's currentVersion is that same local value; guard it so no remote
    // string can ever overwrite the displayed version with an upstream number.
    const localVer = ev.info.currentVersion;
    if (localVer && /^\d+\.\d+\.\d+$/.test(localVer)) {
      appVersion = localVer;
    }
  }

  switch (ev.stage) {
    case 'checking':
      updateBusy = true;
      setUpdateHint(t('menu.checking_short'));
      showUpdateToast(t('toast.checking'), { busy: true, kind: 'transient' });
      break;
    case 'available':
      updateBusy = false;
      if (latestUpdateInfo?.hasUpdate) {
        const ver = latestUpdateInfo.latestVersion;
        const degraded = Boolean(latestUpdateInfo.checkDegraded);
        setUpdateHint(`⬆ v${ver}`, 'ready');
        if (fromManual || dismissedVersion !== ver || degraded) {
          showUpdateToast(
            degraded
              ? `⚠ 发现 v${ver}，自动更新接口受限，请前往发布页下载`
              : formatAvailableUpdateText(ver),
            {
              showInstall: Boolean(latestUpdateInfo.downloadUrl),
              showOpen: !latestUpdateInfo.downloadUrl,
              autoHideMs: degraded ? 6500 : undefined,
              kind: degraded ? 'transient' : 'update',
            },
          );
        }
      }
      break;
    case 'up_to_date':
      updateBusy = false;
      if (ev.info?.checkDegraded) {
        setUpdateHint('↗', 'default');
        showUpdateToast(`⚠ ${ev.info.notesSummary || '自动检查暂不可用，可前往发布页查看'}`, {
          showOpen: true,
          autoHideMs: 5200,
          kind: 'transient',
        });
      } else {
        setUpdateHint(`✓ v${appVersion}`);
        showUpdateToast(`✓ ${t('toast.up_to_date', { ver: appVersion })}`, { autoHideMs: 2600, kind: 'transient' });
      }
      break;
    case 'downloading':
    case 'verifying':
    case 'installing':
      updateBusy = true;
      setUpdateHint(t('menu.checking_short'), 'ready');
      showUpdateToast(`⏳ ${ev.message}`, { busy: true, kind: 'transient' });
      break;
    case 'error': {
      updateBusy = false;
      setUpdateHint('⚠', 'error');
      // GitHub's unauthenticated API often answers 403 (rate limit / proxy).
      // Never surface the raw status code as if the app itself were broken.
      const blocked = /HTTP\s*(403|429)|Forbidden|rate\s*limit|服务器返回|接口受限/i.test(ev.message);
      showUpdateToast(
        blocked ? '⚠ 自动更新接口暂不可用，可打开发布页查看' : `⚠ ${ev.message}`,
        {
          showOpen: true,
          autoHideMs: 5200,
          kind: 'transient',
        },
      );
      break;
    }
  }
}

async function triggerInstallUpdate(): Promise<void> {
  if (updateBusy || !latestUpdateInfo || !latestUpdateInfo.hasUpdate) return;
  updateBusy = true;
  closeContextMenu();
  showUpdateToast(`⏳ 正在下载 v${latestUpdateInfo.latestVersion}...`, { busy: true });
  setUpdateHint('下载中...', 'ready');
  try {
    await invoke('install_update', { info: latestUpdateInfo });
  } catch (err) {
    updateBusy = false;
    const msg = typeof err === 'string' ? err : String(err);
    setUpdateHint('更新失败', 'error');
    showUpdateToast(`⚠ ${msg}`, { showOpen: true, autoHideMs: 6500 });
  }
}

async function triggerManualUpdateCheck(): Promise<void> {
  if (updateBusy) return;
  // If we already know an update is ready, clicking the menu item immediately starts installing it!
  if (latestUpdateInfo?.hasUpdate && latestUpdateInfo.downloadUrl) {
    await triggerInstallUpdate();
    return;
  }
  updateBusy = true;
  setUpdateHint(t('menu.checking_short'));
  closeContextMenu();
  showUpdateToast(t('toast.checking'), { busy: true });
  try {
    const info = await invoke<UpdateInfo>('check_for_update');
    handleUpdateProgressEvent(
      {
        stage: info.hasUpdate ? 'available' : 'up_to_date',
        message: info.hasUpdate
          ? t('toast.available', { ver: info.latestVersion })
          : t('toast.up_to_date', { ver: info.currentVersion }),
        info,
      },
      true,
    );
  } catch (err) {
    const msg = typeof err === 'string' ? err : String(err);
    handleUpdateProgressEvent({ stage: 'error', message: msg, info: null }, true);
  }
}

async function bootstrap(): Promise<void> {
  engine.start();

  // Hide Windows-only desktop shortcut button on macOS
  if (/Mac/i.test(navigator.platform) || /Macintosh/i.test(navigator.userAgent)) {
    const shortcutBtn = document.getElementById('btn-desktop-shortcut');
    if (shortcutBtn) shortcutBtn.style.display = 'none';
  }

  try {
    const [loadedSettings, loadedCats, loadedVer, resolvedLoc, loadedAdmin] = await Promise.all([
      invoke<AppSettings>('get_settings'),
      invoke<CatSkinConfig[]>('get_cats'),
      invoke<string>('get_app_version'),
      invoke<string>('get_resolved_locale').catch(() => ''),
      invoke<{ supported: boolean; elevated: boolean }>('get_admin_status').catch(() => ({
        supported: false,
        elevated: false,
      })),
    ]);
    settings = loadedSettings;
    adminStatus = loadedAdmin;
    lastKnownLockState = settings.clickThroughLocked;
    if (Array.isArray(loadedCats) && loadedCats.length > 0) {
      catList = loadedCats;
    }
    if (loadedVer) {
      appVersion = loadedVer;
      setUpdateHint(`v${appVersion}`);
    }
    if (resolvedLoc) {
      resolvedBackendLocale = resolvedLoc;
    }
    syncMenuUI();
  } catch (err) {
    console.error('Failed to load settings or cats:', err);
  }

  await listen<UpdateProgressEvent>('kuro-update-status', (ev) => {
    handleUpdateProgressEvent(ev.payload, false);
  });

  btnToastInstallEl.addEventListener('click', (e) => {
    e.stopPropagation();
    void triggerInstallUpdate();
  });

  btnToastUnlockEl.addEventListener('click', (e) => {
    e.stopPropagation();
    hideUpdateToast(false);
    void applySettingsPatch({ clickThroughLocked: false });
  });

  btnToastAdminEl?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideUpdateToast(false);
    void invoke('restart_as_admin');
  });

  btnToastOpenEl.addEventListener('click', (e) => {
    e.stopPropagation();
    const url = latestUpdateInfo?.releaseUrl || DESKTOPPET_RELEASES_PAGE;
    void invoke('open_release_page', { url });
  });

  btnToastCloseEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentToastKind === 'update' && latestUpdateInfo?.hasUpdate) {
      dismissedVersion = latestUpdateInfo.latestVersion;
      saveDismissedVersion(latestUpdateInfo.latestVersion);
      hideUpdateToast(false);
    } else if (currentToastKind === 'admin') {
      saveAdminHintDismissed();
      hideUpdateToast(true);
    } else {
      hideUpdateToast(true);
    }
  });

  window.addEventListener('resize', () => {
    if (
      !updateToastEl.classList.contains('hidden') &&
      currentToastKind === 'update' &&
      latestUpdateInfo?.hasUpdate &&
      !updateBusy
    ) {
      updateToastTextEl.textContent = formatAvailableUpdateText(latestUpdateInfo.latestVersion);
    }
  });

  if (scaleSliderEl) {
    scaleSliderEl.addEventListener('pointerdown', () => {
      sliderDragging = true;
    });
    scaleSliderEl.addEventListener('input', () => {
      sliderDragging = true;
      const nextScale = Math.max(0.2, Math.min(1.5, Number(scaleSliderEl.value) / 100));
      updateScaleSliderVisual(nextScale);
      engine.setRenderScale(nextScale);
    });
    const commitSliderScale = () => {
      sliderDragging = false;
      const nextScale = Math.max(0.2, Math.min(1.5, Number(scaleSliderEl.value) / 100));
      void applySettingsPatch({ scale: nextScale });
    };
    scaleSliderEl.addEventListener('change', commitSliderScale);
    scaleSliderEl.addEventListener('pointerup', () => {
      sliderDragging = false;
    });
  }

  if (scaleValueEl) {
    scaleValueEl.addEventListener('click', (e) => {
      e.stopPropagation();
      sliderDragging = false;
      updateScaleSliderVisual(1.0);
      void applySettingsPatch({ scale: 1.0 });
    });
  }

  if (opacitySliderEl) {
    opacitySliderEl.addEventListener('pointerdown', () => {
      opacitySliderDragging = true;
    });
    opacitySliderEl.addEventListener('input', () => {
      opacitySliderDragging = true;
      const nextOpacity = Math.max(0.2, Math.min(1.0, Number(opacitySliderEl.value) / 100));
      updateOpacitySliderVisual(nextOpacity);
      applyPetOpacity(nextOpacity);
      void invoke('preview_opacity', { opacity: nextOpacity }).catch(() => {});
    });
    const commitSliderOpacity = () => {
      opacitySliderDragging = false;
      const nextOpacity = Math.max(0.2, Math.min(1.0, Number(opacitySliderEl.value) / 100));
      void applySettingsPatch({ opacity: nextOpacity });
    };
    opacitySliderEl.addEventListener('change', commitSliderOpacity);
    opacitySliderEl.addEventListener('pointerup', () => {
      opacitySliderDragging = false;
    });
  }

  if (opacityValueEl) {
    opacityValueEl.addEventListener('click', (e) => {
      e.stopPropagation();
      opacitySliderDragging = false;
      updateOpacitySliderVisual(1.0);
      applyPetOpacity(1.0);
      void invoke('preview_opacity', { opacity: 1.0 }).catch(() => {});
      void applySettingsPatch({ opacity: 1.0 });
    });
  }

  await listen<AppSettings>('kuro-settings', (ev) => {
    const prevLock = lastKnownLockState;
    const prevRenderMode = settings.renderMode;
    settings = ev.payload;
    if (prevRenderMode === '2d' && settings.renderMode !== '2d') {
      webgl3dUnavailable = false;
    }
    lastKnownLockState = settings.clickThroughLocked;
    syncMenuUI();
    if (prevLock !== null && prevLock !== settings.clickThroughLocked) {
      if (settings.clickThroughLocked) {
        showUpdateToast(formatLockedToastText(false), {
          showUnlock: true,
          autoHideMs: 4200,
          kind: 'transient',
        });
      } else {
        showUpdateToast(
          window.innerWidth < 260 ? '🔓' : `🔓 ${t('toast.unlocked')}`,
          { autoHideMs: 2200, kind: 'transient' },
        );
      }
    }
  });

  await listen<CatSkinConfig[]>('kuro-cats', (ev) => {
    if (Array.isArray(ev.payload) && ev.payload.length > 0) {
      catList = ev.payload;
      syncMenuUI();
    }
  });

  await listen('kuro-open-tail-picker', () => {
    void openTailPicker();
  });

  await listen<number>('kuro-scale-preview', (ev) => {
    if (typeof ev.payload === 'number' && Number.isFinite(ev.payload)) {
      engine.setRenderScale(Math.max(0.2, Math.min(1.5, ev.payload)));
    }
  });

  await listen<number>('kuro-opacity-preview', (ev) => {
    if (typeof ev.payload === 'number' && Number.isFinite(ev.payload)) {
      applyPetOpacity(ev.payload);
    }
  });

  btnTailDoneEl.addEventListener('click', (e) => {
    e.stopPropagation();
    void confirmTailPicker();
  });

  btnTailCancelEl.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTailPicker();
  });

  window.addEventListener('resize', () => {
    if (tailPickerOpen) syncTailPickerBounds();
    if (careQuickbarOpen) {
      placeCareQuickbar(careQuickbarAnchorX ?? undefined, careQuickbarAnchorY ?? undefined);
      syncCareQuickbarBounds();
      requestAnimationFrame(() => syncWin7OverlayFn?.(false));
    }
  });
  tailPickerBarEl.addEventListener('animationend', () => {
    if (!tailPickerOpen) return;
    syncTailPickerBounds();
    syncWin7OverlayFn?.(false);
  });

  tailPickerBarEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tailpreset]');
    if (!btn) return;
    e.stopPropagation();
    const preset = btn.dataset.tailpreset;
    if (preset) applyTailPreset(preset);
  });

  let lastDragGlobalX: number | null = null;
  let dragInFlight = false;
  let nativeDragActive = false;
  let cancelPendingTapVsDrag: (() => void) | null = null;

  const computeKeySoundPan = (vk: number): number => {
    const kbLayout: KeyboardLayoutId = settings.keyboardLayout === '108' ? '108' : '65';
    const spec = resolveKeyByVk(vk, kbLayout);
    if (!spec) return 0;
    const layout = getKeyboardLayout(kbLayout);
    const centerU = spec.uStart + spec.uWidth * 0.5;
    const normX = Math.max(0, Math.min(1, centerU / layout.totalUnits));
    return (normX * 2 - 1) * 0.35;
  };

  await listen<InputEvent>('kuro-input', (ev) => {
    const p = ev.payload;
    switch (p.kind) {
      case 'keyDown':
        agentCompanion.notifyRealUserInput();
        // Typing semantics (default off): map the VK to a character and feed a
        // rolling buffer so the companion can react to keyword phrases.
        if (settings.companionTypingSemantics === true && !p.repeat && !privacyActive && !gameActive) {
          const ch = vkToChar(p.vk);
          if (ch) {
            typingBuffer = (typingBuffer + ch).slice(-40);
            companion.onTypingText(typingBuffer);
          }
          if (p.vk === 0x0d || p.vk === 0x20) typingBuffer = '';
        }
        if (tailPickerOpen) {
          if (!p.repeat) {
            const spec = resolveKeyByVk(p.vk, settings.keyboardLayout);
            if (spec) {
              toggleTailKeyId(spec.id);
            }
          }
          break;
        }
        if (!p.repeat && settings.typingSoundEnabled) {
          catAudio.playKeyDown(p.vk, computeKeySoundPan(p.vk));
        }
        if (active3d && engine3d) engine3d.onKeyDown(p.vk, p.repeat);
        else engine.onKeyDown(p.vk, p.repeat);
        break;
      case 'keyUp':
        if (!tailPickerOpen && settings.typingSoundEnabled) {
          catAudio.playKeyUp(p.vk, computeKeySoundPan(p.vk));
        }
        if (active3d || tailPickerOpen) engine3d?.onKeyUp(p.vk);
        if (!active3d) {
          engine.onKeyUp(p.vk);
        }
        break;
      case 'mouseMove': {
        if (canvas.classList.contains('pet-dragging') || canvas3d.classList.contains('pet-dragging')) {
          const prevX = lastDragGlobalX;
          lastDragGlobalX = p.nx;
          if (prevX !== null) {
            const vx = (p.nx - prevX) * 68;
            if (active3d && engine3d) engine3d.updateDragVelocity(vx);
            else engine.updateDragVelocity(vx);
          }
        }
        if (active3d && engine3d) engine3d.onGlobalMouseMove(p.nx, p.ny);
        else engine.onGlobalMouseMove(p.nx, p.ny);
        break;
      }
      case 'mouseDown':
        agentCompanion.notifyRealUserInput();
        if (settings.typingSoundEnabled) {
          catAudio.playMouseDown(p.button);
        }
        if (active3d && engine3d) engine3d.onMouseDown(p.button);
        else engine.onMouseDown(p.button);
        break;
      case 'mouseUp':
        if (p.button === 'left') {
          resolveLinuxMouseUp?.();
          cancelPendingTapVsDrag?.();
        }
        if (settings.typingSoundEnabled) {
          catAudio.playMouseUp(p.button);
        }
        if (active3d && engine3d) engine3d.onMouseUp(p.button);
        else engine.onMouseUp(p.button);
        break;
      case 'mouseWheel':
        if (active3d && engine3d) engine3d.onMouseWheel();
        else engine.onMouseWheel();
        break;
      case 'privacyTyping':
        if (active3d && engine3d) engine3d.onPrivacyTyping();
        else engine.onPrivacyTyping();
        break;
    }
  });

  await listen<boolean>('kuro-privacy', (ev) => {
    privacyActive = Boolean(ev.payload);
    engine.setPrivacyMode(privacyActive);
    engine3d?.setPrivacyMode(privacyActive);
    agentCompanion.setPrivacyMode(privacyActive);
  });

  await listen<boolean>('kuro-battery-low', () => {
    companion.onBatteryLow();
  });

  await listen<AgentCompanionEvent>('kuro-agent-event', (ev) => {
    agentCompanion.handleEvent(ev.payload);
  });

  // Pet-care actions requested from the standalone menu window.
  await listen<string>('kuro-pet-care-action', (ev) => {
    const a = String(ev.payload || '');
    if (isPetCareAction(a)) performPetCareAction(a);
  });

  // 提醒到点：菜单侧已把窗口移来中央，这里负责弹出大字并叫一声
  await listen<{ text: string; time: string }>('kuro-reminder-fire', (ev) => {
    showReminderAlert(ev.payload?.text || '时间到啦', ev.payload?.time || '');
  });
  // Standalone menu just opened — push the current care state right away.
  await listen('kuro-pet-care-request', () => {
    void emit('kuro-pet-care-state', getPetCareState()).catch(() => {});
  });

  await listen<string>('kuro-peek-edge', (ev) => {
    const raw = ev.payload;
    const edge: PeekEdge = raw === 'left' || raw === 'right' ? raw : 'none';
    engine.setPeekEdge(edge);
    engine3d?.setPeekEdge(edge);
  });

  await listen<string>('kuro-peek-preview', (ev) => {
    const raw = ev.payload;
    const edge: PeekEdge = raw === 'left' || raw === 'right' ? raw : 'none';
    engine.setPeekPreview(edge);
    engine3d?.setPeekPreview(edge);
  });

  await listen<boolean>('kuro-native-drag', (ev) => {
    const active = Boolean(ev.payload);
    nativeDragActive = active;
    if (active) {
      // macOS unfocused first-click fallback claimed this drag directly in Rust:
      // cancel any armed JS tap detector and enter scruff-lift + velocity sway seamlessly!
      cancelPendingTapVsDrag?.();
      lastDragGlobalX = null;
      canvas.classList.add('pet-dragging');
      canvas3d.classList.add('pet-dragging');
      engine.setPeekPreview('none');
      engine3d?.setPeekPreview('none');
      if (engine.getPeekEdge() !== 'none' || (engine3d?.getPeekEdge() ?? 'none') !== 'none') {
        engine.setPeekEdge('none');
        engine3d?.setPeekEdge('none');
      }
      if (active3d && engine3d) engine3d.setDragging(true);
      else engine.setDragging(true);
    } else if (!dragInFlight) {
      lastDragGlobalX = null;
      canvas.classList.remove('pet-dragging');
      canvas3d.classList.remove('pet-dragging');
      engine.setDragging(false);
      engine3d?.setDragging(false);
      engine.onMouseUp('left');
      engine3d?.onMouseUp('left');
    }
  });

  try {
    gameActive = await invoke<boolean>('get_game_active');
    const wearNow = shouldWearHeadphonesNow();
    engine.setGameActive(gameActive);
    engine3d?.setGameActive(gameActive);
    engine.setHeadphones(wearNow);
    engine3d?.setHeadphones(wearNow);
  } catch {
    // non-Tauri or older backend
  }

  await listen<{ active?: boolean; gameName?: string | null; needsAdmin?: boolean }>('kuro-game-active', (ev) => {
    const prevGame = gameActive;
    gameActive = Boolean(ev.payload?.active);
    if (prevGame !== gameActive) companion.onFocusChanged(gameActive);
    const wearNow = shouldWearHeadphonesNow();
    engine.setGameActive(gameActive);
    engine3d?.setGameActive(gameActive);
    engine.setHeadphones(wearNow);
    engine3d?.setHeadphones(wearNow);

    if (
      isWindowsPlatform() &&
      gameActive &&
      ev.payload?.needsAdmin &&
      !updateBusy &&
      !adminHintShownThisSession &&
      !isAdminHintDismissed()
    ) {
      adminHintShownThisSession = true;
      showUpdateToast(formatAdminGameToastText(), {
        showAdmin: true,
        autoHideMs: 14000,
        kind: 'admin',
      });
    }
  });

  let lastPetHover = false;
  await listen<WindowCursorInfo>('kuro-cursor', (ev) => {
    const c = ev.payload;
    altOverride = Boolean(c.altOverride);
    if (active3d && engine3d) engine3d.onWindowCursor(c.relX, c.relY, c.overCat);
    else engine.onWindowCursor(c.relX, c.relY, c.overCat);
    const interactive = !settings.clickThroughLocked || altOverride;
    const petHover = c.overCat && interactive;
    if (petHover !== lastPetHover) {
      lastPetHover = petHover;
      canvas.classList.toggle('pet-hover', petHover);
      canvas3d.classList.toggle('pet-hover', petHover);
    }
    // The quick bar lives above the pet. Once the cursor leaves the animal
    // (and is not resting on the bar itself), tuck the buttons away.
    if (careQuickbarOpen) {
      if (petHover) cancelCareQuickbarLeave();
      else scheduleCareQuickbarLeave();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!tailPickerOpen) return;
    const hit = engine.hitTestKeyAtClientPoint(e.clientX, e.clientY);
    engine.setTailPickerHover(hit ? hit.id : null);
    canvas.classList.toggle('tail-key-hover', Boolean(hit));
  });

  canvas.addEventListener('mouseleave', () => {
    if (!tailPickerOpen) return;
    engine.setTailPickerHover(null);
    canvas.classList.remove('tail-key-hover');
  });

  // Left-click: quick tap (< 4px / < 220ms) pokes nose/tail/chin/head; drag >= 4px enters scruffed drag mode!
  const usesNativeDrag = isWindowsPlatform() || isMacPlatform();
  let resolveLinuxMouseUp: (() => void) | null = null;
  const waitForFallbackMouseUp = (): Promise<void> =>
    new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolveLinuxMouseUp = null;
        window.removeEventListener('mouseup', finish);
        window.removeEventListener('blur', finish);
        window.clearTimeout(timer);
        resolve();
      };
      resolveLinuxMouseUp = finish;
      window.addEventListener('mouseup', finish, { once: true });
      window.addEventListener('blur', finish, { once: true });
      const timer = window.setTimeout(finish, 15000);
    });

  const runPetWindowDrag = async () => {
    if (dragInFlight) return;
    dragInFlight = true;
    lastDragGlobalX = null;
    canvas.classList.add('pet-dragging');
    canvas3d.classList.add('pet-dragging');
    // Pulling from edge immediately pops out of peek mode into scruffed drag for BOTH cats and dafeiyu!
    // Let backend `start_pet_drag` (Win/macOS) or `wait_linux_drag_end` (Linux X11) atomically read & clear
    // `state.peek_edge` so `pulled_from_edge` suppression has zero IPC race conditions.
    const wasPeeking =
      engine.getPeekEdge() !== 'none' || (engine3d?.getPeekEdge() ?? 'none') !== 'none';
    engine.setPeekPreview('none');
    engine3d?.setPeekPreview('none');
    if (wasPeeking) {
      engine.setPeekEdge('none');
      engine3d?.setPeekEdge('none');
    }
    if (active3d && engine3d) engine3d.setDragging(true);
    else engine.setDragging(true);
    let usedFallbackDrag = false;
    try {
      if (usesNativeDrag) {
        // Both Windows and macOS use native `start_pet_drag`, which coordinates `state.dragging`
        // internally (via atomic `MACOS_NATIVE_DRAG_ACTIVE` on macOS). Do NOT pre-call `set_dragging(true)`
        // beforehand; only call `set_dragging` when falling back to `getCurrentWindow().startDragging()`.
        const nativeHandled = await invoke<boolean>('start_pet_drag').catch(() => false);
        if (!nativeHandled) {
          usedFallbackDrag = true;
          if (wasPeeking) {
            void invoke('set_peek_edge', { edge: 'none' }).catch(() => {});
          }
          void invoke('set_dragging', { dragging: true });
          await getCurrentWindow().startDragging();
        }
      } else {
        usedFallbackDrag = true;
        void invoke('set_dragging', { dragging: true });
        await getCurrentWindow().startDragging();
        // On Linux, GTK `begin_move_drag` resolves immediately (~1ms) before mouse release:
        // wait until the user actually releases Button 1 (with live 200ms edge-peek preview on X11,
        // or falling back to `mouseUp` event on pure Wayland without X11).
        const linuxWaited = await invoke<boolean>('wait_linux_drag_end').catch(() => false);
        if (!linuxWaited) {
          if (wasPeeking) {
            void invoke('set_peek_edge', { edge: 'none' }).catch(() => {});
          }
          await waitForFallbackMouseUp();
        }
      }
    } finally {
      dragInFlight = false;
      lastDragGlobalX = null;
      canvas.classList.remove('pet-dragging');
      canvas3d.classList.remove('pet-dragging');
      engine.setDragging(false);
      engine3d?.setDragging(false);
      engine.onMouseUp('left');
      engine3d?.onMouseUp('left');
      if (usedFallbackDrag) {
        void invoke('set_dragging', { dragging: false });
      }
      void invoke<string>('sync_peek_edge_after_drag')
        .then((raw) => {
          const edge: PeekEdge = raw === 'left' || raw === 'right' ? raw : 'none';
          engine.setPeekEdge(edge);
          engine3d?.setPeekEdge(edge);
          return invoke('save_window_pos');
        })
        .catch(() => {
          void invoke('save_window_pos').catch(() => {});
        });
    }
  };

  const handleCanvasMouseDown = async (e: MouseEvent) => {
    if (e.button !== 0) return;
    closeContextMenu();
    closeCareQuickbar();
    if (tailPickerOpen) {
      const hit = engine.hitTestKeyAtClientPoint(e.clientX, e.clientY);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        toggleTailKeyId(hit.id);
        return;
      }
    }
    if (settings.clickThroughLocked && !altOverride && !e.altKey) return;
    if (nativeDragActive || dragInFlight) return;

    const downX = e.clientX;
    const downY = e.clientY;
    const downAt = performance.now();

    // On Linux, startDragging() must fire synchronously inside mousedown,
    // so only intercept direct taps on the crisp nose/tail hotspots; everywhere else drags immediately.
    if (!usesNativeDrag) {
      const zone =
        active3d && engine3d
          ? engine3d.hitTestCatZoneAtClientPoint(downX, downY)
          : engine.hitTestCatZoneAtClientPoint(downX, downY);
      if (zone === 'nose' || zone === 'tail') {
        if (active3d && engine3d) engine3d.onCatTapAtClientPoint(downX, downY);
        else engine.onCatTapAtClientPoint(downX, downY);
        openCareQuickbar(downX, downY);
        return;
      }
      await runPetWindowDrag();
      return;
    }

    // On Windows & macOS (native 120Hz start_pet_drag), wait up to 4px movement or 220ms hold
    // to cleanly separate Tap (boop nose/tail/chin/head) vs Scruff Drag!
    const DRAG_THRESHOLD_PX = 4;
    const TAP_MAX_MS = 220;
    let settled = false;
    let holdTimer: number | null = null;

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (holdTimer !== null) {
        window.clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (cancelPendingTapVsDrag === onCancel) {
        cancelPendingTapVsDrag = null;
      }
    };

    const beginDrag = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (nativeDragActive) return;
      void runPetWindowDrag();
    };

    const onMove = (ev: MouseEvent) => {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) >= DRAG_THRESHOLD_PX) {
        beginDrag();
      }
    };

    const onUp = (ev: MouseEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (nativeDragActive) return;
      const dt = performance.now() - downAt;
      const dist = Math.hypot(ev.clientX - downX, ev.clientY - downY);
      if (dist < DRAG_THRESHOLD_PX && dt <= TAP_MAX_MS) {
        const zone =
          active3d && engine3d
            ? engine3d.onCatTapAtClientPoint(downX, downY)
            : engine.onCatTapAtClientPoint(downX, downY);
        if (zone) {
          companion.recordInteraction('pet');
          openCareQuickbar(downX, downY);
        }
      }
    };

    const onCancel = () => {
      if (settled) return;
      settled = true;
      cleanup();
    };

    cancelPendingTapVsDrag?.();
    cancelPendingTapVsDrag = onCancel;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    holdTimer = window.setTimeout(beginDrag, TAP_MAX_MS);
  };
  canvas3dMouseDownListener = handleCanvasMouseDown;
  canvas.addEventListener('mousedown', handleCanvasMouseDown);

  // Right-click opens sleek dark glass settings menu (both 2D & 3D canvases!)
  const handleCanvasContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    closeCareQuickbar();
    if (tailPickerSaving) return;
    if (tailPickerOpen) {
      closeTailPicker();
    }
    if (settings.clickThroughLocked && !altOverride && !e.altKey) return;
    openContextMenu(e.clientX, e.clientY);
  };
  canvas3dContextMenuListener = handleCanvasContextMenu;
  canvas.addEventListener('contextmenu', handleCanvasContextMenu);
  const handleCanvasDblClick = () => {
    if (engine.getPeekEdge() !== 'none' || (engine3d?.getPeekEdge() ?? 'none') !== 'none') {
      engine.setPeekEdge('none');
      engine3d?.setPeekEdge('none');
      void invoke('set_peek_edge', { edge: 'none' }).catch(() => {});
    }
  };
  canvas3dDblClickListener = handleCanvasDblClick;
  canvas.addEventListener('dblclick', handleCanvasDblClick);
  bindCanvas3dListeners(canvas3d);

  // Side menu window auto-closes on its own focus loss; do NOT close on main blur (clicking the menu blurs main!)
  window.addEventListener('keydown', (e) => {
    if (tailPickerOpen) {
      // Enter and Space can be selected without activating the focused toolbar button.
      e.preventDefault();
    } else if (e.key === 'Escape') {
      closeContextMenu();
      closeCareQuickbar();
    }
  });

  menuEl.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-action], [data-scale], [data-breed], [data-rendermode], [data-collar], [data-headphonemode], [data-kblayout], [data-kborient], [data-kbtheme], [data-tailmode], [data-fpscap], [data-lang]',
    );
    if (!target) return;

    const fpsAttr = target.dataset.fpscap;
    if (fpsAttr === '0' || fpsAttr === '30') {
      void applySettingsPatch({ fpsCap: fpsAttr === '30' ? 30 : 0 });
      return;
    }

    const langAttr = target.dataset.lang;
    if (langAttr) {
      void applySettingsPatch({ language: normalizeLanguageSetting(langAttr) });
      return;
    }

    const headphoneAttr = target.dataset.headphonemode;
    if (headphoneAttr === 'auto' || headphoneAttr === 'on' || headphoneAttr === 'off') {
      void applySettingsPatch({ headphoneMode: headphoneAttr });
      return;
    }

    const renderModeAttr = target.dataset.rendermode;
    if (renderModeAttr === '2d' || renderModeAttr === '3d') {
      void applySettingsPatch({ renderMode: renderModeAttr });
      return;
    }

    const collarAttr = target.dataset.collar;
    if (
      collarAttr === 'none' ||
      collarAttr === 'red' ||
      collarAttr === 'blue' ||
      collarAttr === 'pink' ||
      collarAttr === 'green'
    ) {
      void applySettingsPatch({ collarColor: collarAttr });
      return;
    }

    const kbLayoutAttr = target.dataset.kblayout;
    if (kbLayoutAttr === '65' || kbLayoutAttr === '108') {
      void applySettingsPatch({ keyboardLayout: kbLayoutAttr });
      closeContextMenu();
      return;
    }

    const kbOrientAttr = target.dataset.kborient;
    if (kbOrientAttr === 'cat' || kbOrientAttr === 'viewer') {
      void applySettingsPatch({ keyboardOrientation: kbOrientAttr });
      closeContextMenu();
      return;
    }

    const kbThemeAttr = target.dataset.kbtheme;
    if (kbThemeAttr === 'oat' || kbThemeAttr === 'mist' || kbThemeAttr === 'clay') {
      void applySettingsPatch({ keyboardTheme: kbThemeAttr });
      return;
    }

    const tailModeAttr = target.dataset.tailmode;
    if (
      tailModeAttr === 'smart' ||
      tailModeAttr === 'custom' ||
      tailModeAttr === 'edge' ||
      tailModeAttr === 'off'
    ) {
      void applySettingsPatch({ tailKeyMode: tailModeAttr });
      return;
    }

    const breedAttr = target.dataset.breed;
    if (breedAttr) {
      void applySettingsPatch({ catBreed: breedAttr });
      closeContextMenu();
      return;
    }

    const scaleAttr = target.dataset.scale;
    if (scaleAttr) {
      void applySettingsPatch({ scale: Number(scaleAttr) });
      closeContextMenu();
      return;
    }

    switch (target.dataset.action) {
      case 'pet-feed':
        performPetCareAction('feed');
        break;
      case 'pet-drink':
        performPetCareAction('drink');
        break;
      case 'pet-play':
        performPetCareAction('play');
        break;
      case 'pet-bath':
        performPetCareAction('bath');
        break;
      case 'toggle-privacy':
        void applySettingsPatch({ privacyPasswordGuard: !(settings.privacyPasswordGuard !== false) });
        break;
      case 'toggle-bubbles':
        void applySettingsPatch({ showKeyBubbles: !settings.showKeyBubbles });
        break;
      case 'toggle-lock':
        void applySettingsPatch({ clickThroughLocked: !settings.clickThroughLocked });
        closeContextMenu();
        break;
      case 'toggle-sound':
        void applySettingsPatch({ soundEnabled: !settings.soundEnabled });
        break;
      case 'toggle-typing-sound':
        void applySettingsPatch({ typingSoundEnabled: !settings.typingSoundEnabled });
        break;
      case 'toggle-top':
        void applySettingsPatch({ alwaysOnTop: !settings.alwaysOnTop });
        break;
      case 'toggle-autostart':
        void applySettingsPatch({ autostart: !settings.autostart });
        break;
      case 'toggle-mcp':
        void applySettingsPatch({ mcpEnabled: !settings.mcpEnabled });
        break;
      case 'copy-mcp':
        void copyMcpConfig();
        break;
      case 'copy-hooks':
        void copyAgentHooksConfig();
        break;
      case 'restart-admin':
        if (adminStatus.supported && !adminStatus.elevated) {
          closeContextMenu();
          void invoke('restart_as_admin').catch(() => {});
        }
        break;
      case 'desktop-shortcut':
        void createDesktopShortcut();
        break;
      case 'check-update':
        void triggerManualUpdateCheck();
        break;
      case 'open-tail-picker':
        void openTailPicker();
        break;
      case 'reset-pos':
        void invoke('reset_position');
        closeContextMenu();
        break;
      case 'quit':
        void invoke('quit_app');
        break;
    }
  });

  // On Windows 7/8 (where Microsoft WebView2 does not support DirectComposition alpha),
  // stream the live 2D Canvas RGBA pixels via zero-copy binary IPC to a native Win32
  // UpdateLayeredWindow(ULW_ALPHA) presenter window for true 256-level per-pixel anti-aliased
  // transparency (zero white box, zero jagged edges) on both Aero and Win7 Basic desktops.
  try {
    const useWin7Ulw = await invoke<boolean>('is_win7_ulw_mode');
    if (useWin7Ulw) {
      isWin7Ulw = true;
      applyPetOpacity(settings.opacity);
      activateRenderEngine();
      document.documentElement.classList.add('win7-ulw-mode');
      const petCtx = canvas.getContext('2d');
      let win7Visible = true;
      let frameBusy = false;
      let lastPresentMs = 0;
      let lastFrameKey = '';
      let lastOverlayKey = '';

      const syncWin7Overlay = (focusMenu = false) => {
        const dpr = Math.max(window.devicePixelRatio || 1, 1);
        const physW = Math.max(1, Math.round(window.innerWidth * dpr));
        const physH = Math.max(1, Math.round(window.innerHeight * dpr));
        const rects: number[] = [];

        if (menuEl && !menuEl.classList.contains('hidden')) {
          const r = menuEl.getBoundingClientRect();
          if (r.width > 2 && r.height > 2) {
            rects.push(
              Math.max(0, Math.floor(r.left * dpr)),
              Math.max(0, Math.floor(r.top * dpr)),
              Math.min(physW, Math.ceil(r.right * dpr)),
              Math.min(physH, Math.ceil(r.bottom * dpr)),
              Math.round(12 * dpr),
            );
          }
        }
        if (tailPickerBarEl && !tailPickerBarEl.classList.contains('hidden')) {
          const toolbar = tailPickerBarEl.getBoundingClientRect();
          const closeButton = btnTailCancelEl.getBoundingClientRect();
          const pickerRegions = [
            { rect: toolbar, radius: 13 },
            { rect: closeButton, radius: closeButton.width / 2 },
          ];
          for (const { rect, radius } of pickerRegions) {
            if (rect.width <= 2 || rect.height <= 2) continue;
            rects.push(
              Math.max(0, Math.floor(rect.left * dpr)),
              Math.max(0, Math.floor(rect.top * dpr)),
              Math.min(physW, Math.ceil(rect.right * dpr)),
              Math.min(physH, Math.ceil(rect.bottom * dpr)),
              Math.round(radius * dpr),
            );
          }
        }
        if (careQuickbarEl && !careQuickbarEl.classList.contains('hidden')) {
          const r = careQuickbarEl.getBoundingClientRect();
          if (r.width > 2 && r.height > 2) {
            rects.push(
              Math.max(0, Math.floor(r.left * dpr)),
              Math.max(0, Math.floor(r.top * dpr)),
              Math.min(physW, Math.ceil(r.right * dpr)),
              Math.min(physH, Math.ceil(r.bottom * dpr)),
              Math.round((careQuickbarEl.classList.contains('care-quickbar--micro') ? 8 : 14) * dpr),
            );
          }
        }
        if (updateToastEl && !updateToastEl.classList.contains('hidden')) {
          const r = updateToastEl.getBoundingClientRect();
          if (r.width > 2 && r.height > 2) {
            const top = Math.max(0, Math.floor(r.top * dpr));
            const bot = Math.min(physH, Math.ceil(r.bottom * dpr));
            rects.push(
              Math.max(0, Math.floor(r.left * dpr)),
              top,
              Math.min(physW, Math.ceil(r.right * dpr)),
              bot,
              Math.max(8, Math.round((bot - top) / 2)),
            );
          }
        }

        const key = rects.join(',');
        if (!focusMenu && key === lastOverlayKey) return;
        lastOverlayKey = key;
        void invoke('win7_sync_overlay', { rects, focusMenu });
      };
      syncWin7OverlayFn = syncWin7Overlay;

      await listen<{ x: number; y: number }>('kuro-win7-contextmenu', (ev) => {
        openContextMenu(ev.payload.x, ev.payload.y);
      });
      await listen('kuro-win7-close-menu', () => {
        closeContextMenu();
      });
      await listen<boolean>('kuro-win7-visibility', (ev) => {
        win7Visible = Boolean(ev.payload);
        if (win7Visible) {
          lastFrameKey = '';
        }
      });

      const presentWin7Frame = () => {
        if (!win7Visible || frameBusy || !petCtx) return;
        const now = performance.now();
        if (now - lastPresentMs < 28) return;
        const w = canvas.width;
        const h = canvas.height;
        if (w < 8 || h < 8) return;

        const imgData = petCtx.getImageData(0, 0, w, h);
        const u32 = new Uint32Array(
          imgData.data.buffer,
          imgData.data.byteOffset,
          imgData.data.byteLength >>> 2,
        );
        let hash = 2166136261 >>> 0;
        hash = Math.imul(hash ^ w, 16777619) >>> 0;
        hash = Math.imul(hash ^ h, 16777619) >>> 0;
        for (let i = 0; i < u32.length; i++) {
          hash = Math.imul(hash ^ u32[i], 16777619) >>> 0;
        }
        const key = `${w}x${h}:${hash}`;
        if (key === lastFrameKey) return;

        lastFrameKey = key;
        lastPresentMs = now;
        frameBusy = true;
        const payload = new Uint8Array(
          imgData.data.buffer,
          imgData.data.byteOffset,
          imgData.data.byteLength,
        );
        void invoke('win7_present_frame', payload, {
          headers: { 'x-w': String(w), 'x-h': String(h) },
        }).finally(() => {
          frameBusy = false;
        });
      };

      engine.onAfterRender = presentWin7Frame;
      // Kick initial presentation immediately & keep overlay bounds in sync if toast/menu resizes
      setTimeout(presentWin7Frame, 30);
      setInterval(() => syncWin7Overlay(false), 200);
    }
  } catch {
    // Non-Win7 or unsupported: keep native transparency untouched
  }

  // Issue #41 safety reminder: when click-through lock was persisted across restarts,
  // briefly show a one-click [解锁] toast so users can never feel trapped (even at 20%-36% scale).
  if (
    settings.clickThroughLocked &&
    !(settings.obsEnabled && settings.obsHidePet) &&
    !(settings.liveCaptureEnabled && settings.liveHidePet)
  ) {
    showUpdateToast(formatLockedToastText(true), {
      showUnlock: true,
      autoHideMs: 5200,
      kind: 'transient',
    });
  }

  // If the background updater already discovered a release before the webview finished loading, show it.
  try {
    const cachedUpd = await invoke<UpdateInfo | null>('get_cached_update_info');
    if (cachedUpd?.hasUpdate) {
      latestUpdateInfo = cachedUpd;
      setUpdateHint(`⬆ v${cachedUpd.latestVersion}`, 'ready');
      if (updateToastEl.classList.contains('hidden')) {
        showPendingUpdateToast();
      }
    }
  } catch {
    // Ignore if command unavailable
  }
}

void bootstrap();
