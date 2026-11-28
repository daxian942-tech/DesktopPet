import './style.css';
import './desktopPetTheme.css';
// 系统页全新视觉层：正方形面板 + 大图标。放在最后以保证覆盖优先级。
import './systemPanel.css';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { DEFAULT_TAIL_KEY_IDS, type KeyboardOrientation, type TailKeyMode } from './catEngine';
import { DEFAULT_BUILTIN_CATS, type CatSkinConfig } from './catSkins';
import { petCareWarning, type PetCareState } from './petCare';
import {
  normalizeKeyboardTheme,
  type KeyboardLayoutId,
  type KeyboardThemeId,
} from './keyboardLayout';
import {
  loadReminders,
  saveReminders,
  sortReminders,
  normalizeReminder,
  createReminderScheduler,
  type Reminder,
  type ReminderRepeat,
  type ReminderScheduler,
} from './reminders';
import {
  applyDomTranslations,
  isMacPlatform,
  localizeBreedName,
  normalizeLanguageSetting,
  setActiveLocale,
  t,
} from './i18n';

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
  obsEnabled: boolean;
  obsPort: number;
  obsHidePet: boolean;
  liveCaptureEnabled?: boolean;
  liveChromaColor?: 'blue' | 'green' | 'magenta';
  liveHidePet?: boolean;
  renderMode?: '2d' | '3d';
  collarColor?: 'none' | 'red' | 'blue' | 'pink' | 'green';
  headphoneMode?: 'auto' | 'on' | 'off';
  fpsCap?: number;
  language?: string;
  companionBond?: boolean;
  companionAmbient?: boolean;
  companionProactive?: boolean;
  companionTypingSemantics?: boolean;
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
  stage: 'checking' | 'available' | 'up_to_date' | 'downloading' | 'verifying' | 'installing' | 'error';
  message: string;
  info?: UpdateInfo | null;
}

interface AdminStatus {
  supported: boolean;
  elevated: boolean;
  macInputDiag?: boolean;
}

type MenuTabId = 'appearance' | 'interact' | 'system';

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
  obsEnabled: false,
  obsPort: 27421,
  obsHidePet: false,
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
let resolvedBackendLocale: string | null = null;
let sliderDragging = false;
let opacitySliderDragging = false;
let currentAppVersion = '1.0.4';
let cachedUpdateInfo: UpdateInfo | null = null;
let updateBusy = false;
// When GitHub's REST API answers 403, the footer button becomes a direct
// "open release page" shortcut instead of showing a raw error / Retry.
let updateCheckDegradedUrl: string | null = null;
const DESKTOPPET_RELEASES_PAGE = 'https://github.com/daxian942-tech/DesktopPet/releases/latest';
let activeTab: MenuTabId = 'appearance';
let settingsPatchSeq = 0;
/** 是否运行在 Tauri 里（bootstrap 里探测后回填），提醒触发等 IPC 要据此判断。 */
let inTauri = true;
let adminStatus: AdminStatus = { supported: false, elevated: false, macInputDiag: false };

const menuEl = document.getElementById('context-menu') as HTMLDivElement;
const tabBodyEl = document.getElementById('menu-tab-body') as HTMLDivElement | null;
const breedPillsEl = document.getElementById('breed-pills') as HTMLDivElement;
const scaleSliderEl = document.getElementById('scale-slider') as HTMLInputElement;
const scaleValueEl = document.getElementById('scale-value') as HTMLButtonElement;
const opacitySliderEl = document.getElementById('opacity-slider') as HTMLInputElement | null;
const opacityValueEl = document.getElementById('opacity-value') as HTMLButtonElement | null;
const tailModeBadgeEl = document.getElementById('tail-mode-badge') as HTMLSpanElement;
const tailKeysCountEl = document.getElementById('tail-keys-count') as HTMLSpanElement;
const btnOpenTailPickerEl = document.getElementById('btn-open-tail-picker') as HTMLButtonElement | null;
const langSelectEl = document.getElementById('lang-select') as HTMLSelectElement | null;
const btnHeaderAdminEl = document.getElementById('btn-header-admin') as HTMLButtonElement | null;
const btnRestartAdminEl = document.getElementById('btn-restart-admin') as HTMLButtonElement | null;
const adminRestartLabelEl = document.getElementById('admin-restart-label') as HTMLSpanElement | null;
const btnMacInputDiagEl = document.getElementById('btn-mac-input-diag') as HTMLButtonElement | null;
const macInputDiagLabelEl = document.getElementById('mac-input-diag-label') as HTMLSpanElement | null;
const btnHeaderLockEl = document.getElementById('btn-header-lock') as HTMLButtonElement | null;
const mcpCardBodyEl = document.getElementById('mcp-card-body') as HTMLDivElement | null;
const obsCardBodyEl = document.getElementById('obs-card-body') as HTMLDivElement | null;
const obsPortPillEl = document.getElementById('obs-port-pill') as HTMLSpanElement | null;
const liveCardBodyEl = document.getElementById('live-card-body') as HTMLDivElement | null;
const btnCheckUpdateEl = document.getElementById('btn-check-update') as HTMLButtonElement | null;
const lockKbdEl = document.getElementById('lock-kbd') as HTMLElement | null;

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

function switchTab(nextTab: MenuTabId): void {
  activeTab = nextTab;
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
    const isActive = btn.dataset.tab === activeTab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  document.querySelectorAll<HTMLElement>('[data-tab-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.tabPanel !== activeTab);
  });
  if (tabBodyEl) {
    tabBodyEl.scrollTop = 0;
  }
}

function renderFooterUpdateState(customLabel?: string, ready = false): void {
  const hint = document.getElementById('update-hint');
  const isReady = ready || Boolean(cachedUpdateInfo?.hasUpdate);
  if (btnCheckUpdateEl) {
    btnCheckUpdateEl.classList.toggle('update-ready', isReady);
  }
  if (!hint) return;
  if (customLabel) {
    hint.textContent = customLabel;
  } else if (cachedUpdateInfo?.hasUpdate) {
    hint.textContent = `⬆ ${t('menu.update_ready', { ver: cachedUpdateInfo.latestVersion })}`;
  } else {
    hint.textContent = t('menu.check_update', { ver: currentAppVersion });
  }
}

function closeMenu(): void {
  void invoke('close_context_menu');
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

function normalizeOpacity(opacityVal: number | undefined): number {  if (typeof opacityVal !== 'number' || !Number.isFinite(opacityVal)) return 1;
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

function renderBreedPills(): void {
  if (!breedPillsEl) return;
  breedPillsEl.innerHTML = '';
  for (const cat of catList) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'breed-pill';
    btn.dataset.breed = cat.id;
    const label = formatBreedPillLabel(cat);
    const displayName = localizeBreedName(cat.id, cat.name, cat.builtin);
    const emoji = cat.emoji || '🐱';
    const bareName = displayName.startsWith(emoji)
      ? displayName.slice(emoji.length).trimStart() || displayName
      : displayName.replace(/^[^\u4e00-\u9fffA-Za-z]+/, '').trim() || displayName;

    // 大图标卡片：上面一个大 emoji，下面动物名字，点起来比原来的文字芯片好按。
    const icon = document.createElement('span');
    icon.className = 'breed-icon';
    icon.textContent = emoji;
    const name = document.createElement('span');
    name.className = 'breed-name';
    name.textContent = bareName;
    btn.append(icon, name);
    btn.title = label;
    const accent = cat.accentColor || (cat.id === 'ragdoll' ? '#7ac7ff' : '#c8f538');
    btn.style.setProperty('--pill-accent', accent);
    btn.classList.toggle('active', cat.id === settings.catBreed);
    breedPillsEl.appendChild(btn);
  }
}

function setToggleSwitch(id: string, on: boolean): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('is-on', on);
  el.setAttribute('aria-checked', on ? 'true' : 'false');
}

/* ---------------- 互动模块：定时提醒 ---------------- */

let reminderList: Reminder[] = [];
let reminderRepeat: ReminderRepeat = 'once';
let reminderScheduler: ReminderScheduler | null = null;
let reminderCountdownTimer: number | null = null;

function reminderEls() {
  return {
    list: document.getElementById('reminder-list'),
    empty: document.getElementById('reminder-empty'),
    next: document.getElementById('reminder-next'),
    time: document.getElementById('reminder-time') as HTMLInputElement | null,
    text: document.getElementById('reminder-text') as HTMLInputElement | null,
  };
}

function fmtRelative(sec: number): string {
  if (sec < 60) return `${sec} 秒后`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} 分钟后`;
  const h = Math.floor(min / 60);
  return `${h} 小时 ${min % 60} 分后`;
}

function renderReminderNext(): void {
  const { next } = reminderEls();
  if (!next) return;
  const sec = reminderScheduler?.nextIn() ?? null;
  if (sec === null) {
    next.textContent = '未设置';
    return;
  }
  next.textContent = fmtRelative(sec);
}

function renderReminderList(): void {
  const { list, empty } = reminderEls();
  if (!list) return;
  list.innerHTML = '';
  const sorted = sortReminders(reminderList);
  if (sorted.length === 0) {
    empty?.classList.remove('hidden');
  } else {
    empty?.classList.add('hidden');
  }
  for (const r of sorted) {
    const row = document.createElement('div');
    row.className = 'reminder-item' + (r.enabled ? '' : ' is-off');
    row.dataset.remid = r.id;

    const time = document.createElement('span');
    time.className = 'reminder-item-time';
    time.textContent = r.time;

    const main = document.createElement('span');
    main.className = 'reminder-item-main';
    const txt = document.createElement('span');
    txt.className = 'reminder-item-text';
    txt.textContent = r.text;
    const tag = document.createElement('span');
    tag.className = 'reminder-item-tag';
    tag.textContent = r.repeat === 'daily' ? '每天重复' : '仅一次';
    main.append(txt, tag);

    const actions = document.createElement('span');
    actions.className = 'reminder-item-actions';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'reminder-mini-toggle' + (r.enabled ? ' is-on' : '');
    toggle.title = r.enabled ? '关闭这条提醒' : '开启这条提醒';
    toggle.dataset.remtoggle = r.id;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'reminder-del';
    del.textContent = '✕';
    del.title = '删除这条提醒';
    del.dataset.remdel = r.id;
    actions.append(toggle, del);

    row.append(time, main, actions);
    list.appendChild(row);
  }
  renderReminderNext();
}

function persistReminders(): void {
  saveReminders(reminderList);
  renderReminderList();
  reminderScheduler?.tickNow();
}

function addReminderFromForm(): void {
  const { time, text } = reminderEls();
  if (!time) return;
  const t = time.value || '09:00';
  const body = (text?.value || '').trim() || '时间到啦';
  reminderList.push(
    normalizeReminder({
      time: t,
      text: body,
      repeat: reminderRepeat,
      enabled: true,
    }),
  );
  if (text) text.value = '';
  persistReminders();
}

/**
 * 到点：让主窗口跑到屏幕中间，并让桌宠弹出大字提醒。
 * 桌宠窗口不在菜单里，靠 Tauri 事件通知。
 */
async function fireReminder(r: Reminder): Promise<void> {
  // 记录已触发，避免同日重复
  const now = new Date();
  const ymd = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;
  reminderList = reminderList.map((x) =>
    x.id === r.id ? { ...x, lastFired: r.repeat === 'once' ? ymd : ymd } : x,
  );
  saveReminders(reminderList);
  renderReminderList();

  if (!inTauri) return;
  try {
    // 1) 桌宠跑到屏幕正中
    await invoke('move_pet_to_center');
    // 2) 通知主窗口展示提醒大字
    await emit('kuro-reminder-fire', { text: r.text, time: r.time });
  } catch {
    // 忽略：窗口移动失败也要尽量把提示送达
    try {
      await emit('kuro-reminder-fire', { text: r.text, time: r.time });
    } catch {
      /* ignore */
    }
  }
}

function initReminders(): void {
  reminderList = loadReminders();
  reminderScheduler = createReminderScheduler(() => reminderList);
  reminderScheduler.start((r) => {
    void fireReminder(r);
  });

  const addBtn = document.getElementById('reminder-add');
  addBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    addReminderFromForm();
  });

  const textInput = document.getElementById('reminder-text') as HTMLInputElement | null;
  textInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addReminderFromForm();
    }
  });

  // 重复方式切换
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-remrepeat]')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      reminderRepeat = btn.dataset.remrepeat === 'daily' ? 'daily' : 'once';
      for (const b of document.querySelectorAll<HTMLButtonElement>('[data-remrepeat]')) {
        b.classList.toggle('active', b === btn);
      }
    });
  }

  // 列表内：开关键 / 删除（委托到列表容器）
  const list = document.getElementById('reminder-list');
  list?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const toggle = target.closest<HTMLElement>('[data-remtoggle]');
    if (toggle) {
      e.stopPropagation();
      const id = toggle.dataset.remtoggle!;
      reminderList = reminderList.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x));
      persistReminders();
      return;
    }
    const del = target.closest<HTMLElement>('[data-remdel]');
    if (del) {
      e.stopPropagation();
      const id = del.dataset.remdel!;
      reminderList = reminderList.filter((x) => x.id !== id);
      persistReminders();
    }
  });

  renderReminderList();

  // 每 20 秒刷新一次「还有多久」的倒计时文案
  if (reminderCountdownTimer === null) {
    reminderCountdownTimer = window.setInterval(renderReminderNext, 20_000);
  }
}

function syncUI(): void {
  setActiveLocale(settings.language, resolvedBackendLocale);
  applyDomTranslations();

  if (lockKbdEl) {
    lockKbdEl.textContent = isMacPlatform() ? 'Option' : 'Alt';
  }

  setToggleSwitch('sw-privacy', settings.privacyPasswordGuard !== false);
  setToggleSwitch('sw-companion-bond', settings.companionBond !== false);
  setToggleSwitch('sw-companion-ambient', settings.companionAmbient !== false);
  setToggleSwitch('sw-companion-proactive', settings.companionProactive === true);
  setToggleSwitch('sw-companion-typing', settings.companionTypingSemantics === true);
  setToggleSwitch('sw-bubbles', settings.showKeyBubbles);
  setToggleSwitch('sw-lock', settings.clickThroughLocked);
  setToggleSwitch('sw-sound', settings.soundEnabled);
  setToggleSwitch('sw-typing-sound', Boolean(settings.typingSoundEnabled));
  setToggleSwitch('sw-top', settings.alwaysOnTop);
  setToggleSwitch('sw-autostart', settings.autostart);
  setToggleSwitch('sw-mcp', settings.mcpEnabled);
  setToggleSwitch('sw-obs', Boolean(settings.obsEnabled));
  setToggleSwitch('sw-obs-hide', Boolean(settings.obsEnabled && settings.obsHidePet));
  setToggleSwitch('sw-live', Boolean(settings.liveCaptureEnabled));
  setToggleSwitch('sw-live-hide', Boolean(settings.liveCaptureEnabled && settings.liveHidePet));

  if (btnHeaderLockEl) {
    btnHeaderLockEl.classList.toggle('is-locked', settings.clickThroughLocked);
    btnHeaderLockEl.setAttribute('aria-pressed', settings.clickThroughLocked ? 'true' : 'false');
  }

  const adminText = t(adminStatus.elevated ? 'menu.admin_ready' : 'menu.admin_restart');
  const macDiagText = t('menu.mac_input_diag');
  const showHeaderShield = adminStatus.supported || Boolean(adminStatus.macInputDiag);
  if (btnHeaderAdminEl) {
    btnHeaderAdminEl.classList.toggle('hidden', !showHeaderShield);
    btnHeaderAdminEl.classList.toggle('is-elevated', adminStatus.supported && adminStatus.elevated);
    btnHeaderAdminEl.disabled = adminStatus.supported && adminStatus.elevated;
    btnHeaderAdminEl.dataset.action = adminStatus.supported ? 'restart-admin' : 'mac-input-diag';
    const headerTip = adminStatus.supported ? adminText : macDiagText;
    btnHeaderAdminEl.title = headerTip;
    btnHeaderAdminEl.setAttribute('aria-label', headerTip);
  }
  if (btnRestartAdminEl) {
    btnRestartAdminEl.classList.toggle('hidden', !adminStatus.supported);
    btnRestartAdminEl.classList.toggle('is-elevated', adminStatus.elevated);
    btnRestartAdminEl.disabled = adminStatus.elevated;
    btnRestartAdminEl.title = adminText;
  }
  if (adminRestartLabelEl) {
    adminRestartLabelEl.textContent = adminText;
  }
  if (btnMacInputDiagEl) {
    btnMacInputDiagEl.classList.toggle('hidden', !adminStatus.macInputDiag);
    btnMacInputDiagEl.title = macDiagText;
  }
  if (macInputDiagLabelEl) {
    macInputDiagLabelEl.textContent = macDiagText;
  }

  // Conditionally reveal MCP, OBS & Live Capture bodies only when enabled
  if (mcpCardBodyEl) {
    mcpCardBodyEl.classList.toggle('hidden', !settings.mcpEnabled);
  }
  if (obsCardBodyEl) {
    obsCardBodyEl.classList.toggle('hidden', !settings.obsEnabled);
  }
  if (obsPortPillEl) {
    obsPortPillEl.textContent = `:${settings.obsPort || 27421}`;
    obsPortPillEl.classList.toggle('hidden', !settings.obsEnabled);
  }
  if (liveCardBodyEl) {
    liveCardBodyEl.classList.toggle('hidden', !settings.liveCaptureEnabled);
  }
  const liveChromaColor =
    settings.liveChromaColor === 'green' || settings.liveChromaColor === 'magenta'
      ? settings.liveChromaColor
      : 'blue';
  document.querySelectorAll<HTMLButtonElement>('[data-livechroma]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.livechroma === liveChromaColor);
  });

  const obsHint = document.getElementById('obs-copy-hint');
  if (obsHint && !obsHint.classList.contains('copied')) {
    obsHint.textContent = t('menu.obs_hint');
  }
  const mcpHint = document.getElementById('mcp-copy-hint');
  if (mcpHint && !mcpHint.classList.contains('copied')) {
    mcpHint.textContent = t('menu.copy_mcp');
  }
  const hooksHint = document.getElementById('hooks-copy-hint');
  if (hooksHint && !hooksHint.classList.contains('copied')) {
    hooksHint.textContent = t('menu.copy_hooks');
  }
  const shortcutHint = document.getElementById('shortcut-hint');
  if (shortcutHint && !shortcutHint.classList.contains('copied')) {
    shortcutHint.textContent = t('menu.desktop_shortcut_short');
  }

  if (!sliderDragging) {
    updateScaleSliderVisual(settings.scale);
  }
  if (!opacitySliderDragging) {
    updateOpacitySliderVisual(settings.opacity);
  }

  const kbLayout: KeyboardLayoutId = settings.keyboardLayout === '108' ? '108' : '65';
  const kbOrient: KeyboardOrientation = settings.keyboardOrientation === 'viewer' ? 'viewer' : 'cat';
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

  const fpsCap = settings.fpsCap === 30 ? '30' : '0';
  document.querySelectorAll<HTMLButtonElement>('[data-fpscap]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.fpscap === fpsCap);
  });

  const langSetting = normalizeLanguageSetting(settings.language);
  if (langSelectEl) {
    langSelectEl.value = langSetting;
  }

  const tailMode: TailKeyMode =
    settings.tailKeyMode === 'custom' ||
    settings.tailKeyMode === 'edge' ||
    settings.tailKeyMode === 'off'
      ? settings.tailKeyMode
      : 'smart';
  const tailIds = Array.isArray(settings.tailKeyIds) ? settings.tailKeyIds : [...DEFAULT_TAIL_KEY_IDS];
  document.querySelectorAll<HTMLButtonElement>('[data-tailmode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tailmode === tailMode);
  });
  if (tailModeBadgeEl) {
    tailModeBadgeEl.textContent = t(`menu.tail_badge_${tailMode}`);
  }
  if (tailKeysCountEl) {
    tailKeysCountEl.textContent = t('menu.tail_keys_count', { count: tailIds.length });
  }
  if (btnOpenTailPickerEl) {
    btnOpenTailPickerEl.classList.toggle('hidden', tailMode !== 'custom');
  }

  const activeCat = catList.find((c) => c.id === settings.catBreed) ?? catList[0];
  renderBreedPills();

  const renderMode = settings.renderMode === '2d' ? '2d' : '3d';
  const collarColor =
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
    const isActive = btn.dataset.collar === collarColor;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });

  const isDafeiyu = settings.catBreed === 'dafeiyu';
  const styleCardEl = document.getElementById('style-card');
  if (styleCardEl) {
    styleCardEl.classList.toggle('hidden', isDafeiyu);
  }
  const renderModeRowEl = document.getElementById('render-mode-row');
  if (renderModeRowEl) {
    renderModeRowEl.classList.toggle('hidden', isDafeiyu);
  }
  const collarRowEl = document.getElementById('collar-row');
  if (collarRowEl) {
    collarRowEl.classList.toggle('hidden', renderMode === '2d' || isDafeiyu);
  }

  const headphoneMode =
    settings.headphoneMode === 'auto' || settings.headphoneMode === 'on'
      ? settings.headphoneMode
      : 'off';
  document.querySelectorAll<HTMLButtonElement>('[data-headphonemode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.headphonemode === headphoneMode);
  });
  const headphoneRowEl = document.getElementById('headphone-row');
  if (headphoneRowEl) {
    headphoneRowEl.classList.toggle('hidden', isDafeiyu);
  }

  const headerEl = document.getElementById('menu-header');
  if (headerEl && activeCat) {
    headerEl.textContent = formatHeaderCatName(activeCat);
    headerEl.style.color = activeCat.accentColor || '#c8f538';
  }

  if (!updateBusy) {
    renderFooterUpdateState();
  }
}

async function applySettingsPatch(patch: Partial<AppSettings>): Promise<void> {
  const seq = ++settingsPatchSeq;
  settings = { ...settings, ...patch };
  syncUI();
  try {
    const updated = await invoke<AppSettings>('update_settings', { patch: settings });
    if (seq !== settingsPatchSeq) return;
    settings = updated;
    syncUI();
  } catch (err) {
    console.error('Failed to update settings:', err);
  }
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

async function copyMcpConfig(): Promise<void> {
  const hint = document.getElementById('mcp-copy-hint');
  try {
    const jsonText = await invoke<string>('get_mcp_config');
    await copyText(jsonText);
    if (hint) {
      hint.textContent = t('menu.copied_hint');
      hint.classList.add('copied');
      setTimeout(() => {
        hint.textContent = t('menu.copy_mcp');
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
    await copyText(jsonText);
    if (hint) {
      hint.textContent = t('menu.copied_hint');
      hint.classList.add('copied');
      setTimeout(() => {
        hint.textContent = t('menu.copy_hooks');
        hint.classList.remove('copied');
      }, 1800);
    }
  } catch (err) {
    console.error('Failed to copy Agent hooks config:', err);
  }
}

async function copyObsUrl(): Promise<void> {
  const hint = document.getElementById('obs-copy-hint');
  try {
    if (!settings.obsEnabled) {
      await applySettingsPatch({ obsEnabled: true });
    }
    const url = await invoke<string>('get_obs_url');
    await copyText(url);
    if (hint) {
      hint.textContent = t('menu.copied_hint');
      hint.classList.add('copied');
      setTimeout(() => {
        hint.classList.remove('copied');
        hint.textContent = t('menu.obs_hint');
      }, 2000);
    }
  } catch (err) {
    console.error('Failed to copy OBS url:', err);
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
        hint.textContent = t('menu.desktop_shortcut_short');
        hint.classList.remove('copied');
      }, 1800);
    }
  } catch (err) {
    console.error('Failed to create shortcut:', err);
    if (hint) {
      hint.textContent = '✕';
      setTimeout(() => {
        hint.textContent = t('menu.desktop_shortcut_short');
      }, 1800);
    }
  }
}

async function triggerManualUpdateCheck(): Promise<void> {
  if (updateBusy) return;
  if (cachedUpdateInfo?.hasUpdate) {
    if (cachedUpdateInfo.downloadUrl) {
      updateBusy = true;
      renderFooterUpdateState(t('menu.checking_short'), true);
      closeMenu();
      try {
        await invoke('install_update', { info: cachedUpdateInfo });
      } catch {
        updateBusy = false;
        renderFooterUpdateState();
      }
      return;
    }
    if (cachedUpdateInfo.releaseUrl) {
      void invoke('open_release_page', { url: cachedUpdateInfo.releaseUrl });
      closeMenu();
      return;
    }
  }

  updateBusy = true;
  renderFooterUpdateState(t('menu.checking_short'), false);
  try {
    const info = await invoke<UpdateInfo>('check_for_update');
    updateBusy = false;
    cachedUpdateInfo = info;
    if (info.checkDegraded) {
      // No raw "服务器返回 HTTP 403" / "Retry": the footer now opens the
      // release page directly so the user can still check manually.
      updateCheckDegradedUrl = info.releaseUrl || DESKTOPPET_RELEASES_PAGE;
      renderFooterUpdateState(
        info.hasUpdate ? `↗ v${info.latestVersion}` : '↗ 打开发布页',
        false,
      );
      return;
    }
    updateCheckDegradedUrl = null;
    if (info.hasUpdate) {
      renderFooterUpdateState(`⬆ ${t('menu.update_ready', { ver: info.latestVersion })}`, true);
    } else {
      renderFooterUpdateState(`✓ v${info.currentVersion}`, false);
      setTimeout(() => {
        renderFooterUpdateState();
      }, 2200);
    }
  } catch {
    updateBusy = false;
    updateCheckDegradedUrl = DESKTOPPET_RELEASES_PAGE;
    renderFooterUpdateState('↗ 打开发布页', false);
  }
}

async function bootstrap(): Promise<void> {
  if (isMacPlatform()) {
    const shortcutBtn = document.getElementById('btn-desktop-shortcut');
    if (shortcutBtn) shortcutBtn.classList.add('hidden');
    const actionRow = document.getElementById('sys-action-row');
    if (actionRow) actionRow.classList.add('single-action');
  }

  let resolveInitReady!: () => void;
  const initReadyPromise = new Promise<void>((resolve) => {
    resolveInitReady = resolve;
  });

  // Register menu click delegation immediately so fast clicks right after side-menu
  // recreation (post 25s idle destroy) are queued behind initial IPC load rather than dropped.
  menuEl.addEventListener('click', (e) => {
    const tabBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tab]');
    if (tabBtn) {
      const next = tabBtn.dataset.tab;
      if (next === 'appearance' || next === 'interact' || next === 'system') {
        switchTab(next);
      }
      return;
    }

    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-action], [data-breed], [data-rendermode], [data-collar], [data-headphonemode], [data-kblayout], [data-kborient], [data-kbtheme], [data-tailmode], [data-fpscap], [data-livechroma]',
    );
    if (!target) return;

    void initReadyPromise.then(() => {
      const liveChromaAttr = target.dataset.livechroma;
      if (liveChromaAttr === 'blue' || liveChromaAttr === 'green' || liveChromaAttr === 'magenta') {
        void applySettingsPatch({ liveChromaColor: liveChromaAttr });
        return;
      }

      const fpsAttr = target.dataset.fpscap;
      if (fpsAttr === '0' || fpsAttr === '30') {
        void applySettingsPatch({ fpsCap: fpsAttr === '30' ? 30 : 0 });
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
        return;
      }

      const kbOrientAttr = target.dataset.kborient;
      if (kbOrientAttr === 'cat' || kbOrientAttr === 'viewer') {
        void applySettingsPatch({ keyboardOrientation: kbOrientAttr });
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
        return;
      }

      switch (target.dataset.action) {
        case 'pet-feed':
        case 'pet-drink':
        case 'pet-play':
        case 'pet-bath': {
          const careAction = target.dataset.action!.replace('pet-', '') as
            | 'feed'
            | 'drink'
            | 'play'
            | 'bath';
          // The pet lives in the main window — forward the action through Tauri.
          void emit('kuro-pet-care-action', careAction).catch(() => {});
          break;
        }
        case 'toggle-privacy':
          void applySettingsPatch({ privacyPasswordGuard: !(settings.privacyPasswordGuard !== false) });
          break;
        case 'toggle-companion-bond':
          void applySettingsPatch({ companionBond: !(settings.companionBond !== false) });
          break;
        case 'toggle-companion-ambient':
          void applySettingsPatch({ companionAmbient: !(settings.companionAmbient !== false) });
          break;
        case 'toggle-companion-proactive':
          void applySettingsPatch({ companionProactive: !settings.companionProactive });
          break;
        case 'toggle-companion-typing':
          void applySettingsPatch({ companionTypingSemantics: !settings.companionTypingSemantics });
          break;
        case 'toggle-bubbles':
          void applySettingsPatch({ showKeyBubbles: !settings.showKeyBubbles });
          break;
        case 'toggle-lock':
          void applySettingsPatch({ clickThroughLocked: !settings.clickThroughLocked });
          closeMenu();
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
        case 'toggle-obs': {
          const nextObs = !settings.obsEnabled;
          void applySettingsPatch({
            obsEnabled: nextObs,
            obsHidePet: nextObs ? settings.obsHidePet : false,
          });
          break;
        }
        case 'copy-obs':
          void copyObsUrl();
          break;
        case 'toggle-obs-hide': {
          const nextHide = !settings.obsHidePet;
          void applySettingsPatch({ obsHidePet: nextHide });
          if (nextHide) {
            closeMenu();
          }
          break;
        }
        case 'toggle-live-capture': {
          const nextLive = !settings.liveCaptureEnabled;
          void applySettingsPatch({
            liveCaptureEnabled: nextLive,
            liveHidePet: nextLive ? Boolean(settings.liveHidePet) : false,
          });
          break;
        }
        case 'toggle-live-hide': {
          const nextHide = !settings.liveHidePet;
          void applySettingsPatch({ liveHidePet: nextHide });
          if (nextHide) {
            closeMenu();
          }
          break;
        }
        case 'toggle-mcp':
          void applySettingsPatch({ mcpEnabled: !settings.mcpEnabled });
          break;
        case 'copy-mcp':
          void copyMcpConfig();
          break;
        case 'copy-hooks':
          void copyAgentHooksConfig();
          break;
        case 'open-tail-picker':
          void invoke('open_tail_picker_from_menu');
          break;
        case 'restart-admin':
          if (adminStatus.supported && !adminStatus.elevated) {
            closeMenu();
            void invoke('restart_as_admin').catch(() => {});
          }
          break;
        case 'mac-input-diag':
          if (adminStatus.macInputDiag) {
            closeMenu();
            void invoke('diagnose_macos_input').catch(() => {});
          }
          break;
        case 'desktop-shortcut':
          void createDesktopShortcut();
          break;
        case 'reset-pos':
          void invoke('reset_position');
          closeMenu();
          break;
        case 'check-update':
          if (updateCheckDegradedUrl) {
            const url = updateCheckDegradedUrl;
            updateCheckDegradedUrl = null;
            renderFooterUpdateState();
            void invoke('open_release_page', { url });
          } else {
            void triggerManualUpdateCheck();
          }
          break;
        case 'quit':
          void invoke('quit_app');
          break;
      }
    });
  });

  if (langSelectEl) {
    langSelectEl.addEventListener('change', () => {
      void initReadyPromise.then(() => {
        void applySettingsPatch({ language: normalizeLanguageSetting(langSelectEl.value) });
      });
    });
  }

  // 复用模块级 inTauri（默认 true），探测失败时置 false
  try {
    const [loadedSettings, loadedCats, ver, cachedUpd, resolvedLoc, loadedAdmin] = await Promise.all([
      invoke<AppSettings>('get_settings'),
      invoke<CatSkinConfig[]>('get_cats'),
      invoke<string>('get_app_version'),
      invoke<UpdateInfo | null>('get_cached_update_info').catch(() => null),
      invoke<string>('get_resolved_locale').catch(() => ''),
      invoke<AdminStatus>('get_admin_status').catch(() => ({ supported: false, elevated: false })),
    ]);
    settings = loadedSettings;
    adminStatus = loadedAdmin;
    if (Array.isArray(loadedCats) && loadedCats.length > 0) {
      catList = loadedCats;
    }
    if (ver) {
      currentAppVersion = ver;
    }
    if (cachedUpd) {
      // Discard stale update cache captured from a different version line
      // (e.g. an upstream 5.1.3 result cached before the DesktopPet rebrand).
      if (!cachedUpd.currentVersion || cachedUpd.currentVersion === ver) {
        cachedUpdateInfo = cachedUpd;
      }
    }
    if (resolvedLoc) {
      resolvedBackendLocale = resolvedLoc;
    }
  } catch (err) {
    inTauri = false;
    console.warn('Running menu outside Tauri IPC:', err);
    // Allow static browser layout verification via ?lang=en-US&tab=system&obs=1&tail=custom
    const params = new URLSearchParams(window.location.search);
    const qLang = params.get('lang');
    if (qLang) settings.language = qLang;
    if (params.get('obs') === '1') settings.obsEnabled = true;
    if (params.get('live') === '1') settings.liveCaptureEnabled = true;
    if (params.get('mcp') === '0') settings.mcpEnabled = false;
    const qTail = params.get('tail');
    if (qTail === 'smart' || qTail === 'custom' || qTail === 'edge' || qTail === 'off') {
      settings.tailKeyMode = qTail;
    }
    const qBreed = params.get('breed');
    if (qBreed) settings.catBreed = qBreed;
    const qTab = params.get('tab');
    if (qTab === 'appearance' || qTab === 'interact' || qTab === 'system') activeTab = qTab;
    // Populate all 7 built-in cats for realistic layout verification outside Tauri
    catList = [
      ...DEFAULT_BUILTIN_CATS.slice(0, 2),
      { ...DEFAULT_BUILTIN_CATS[0], id: 'orange-tabby', name: '大橘猫', emoji: '🍊', accentColor: '#ff9f43' },
      { ...DEFAULT_BUILTIN_CATS[0], id: 'calico', name: '三花猫', emoji: '🌸', accentColor: '#ff7eb3' },
      { ...DEFAULT_BUILTIN_CATS[0], id: 'tuxedo', name: '奶牛猫', emoji: '🐄', accentColor: '#d0d7de' },
      { ...DEFAULT_BUILTIN_CATS[0], id: 'siamese', name: '暹罗猫', emoji: '☕', accentColor: '#c9a679' },
      DEFAULT_BUILTIN_CATS[2],
    ];
  }
  syncUI();
  renderFooterUpdateState();
  switchTab(activeTab);
  initReminders();
  resolveInitReady();

  if (inTauri) {
    const isWin7 = await invoke<boolean>('is_win7_ulw_mode').catch(() => false);
    if (isWin7) {
      document.documentElement.classList.add('win7-ulw-mode');
    }
  }

  document.getElementById('btn-close-menu')?.addEventListener('click', () => closeMenu());

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  if (scaleSliderEl) {
    scaleSliderEl.addEventListener('pointerdown', () => {
      sliderDragging = true;
    });
    scaleSliderEl.addEventListener('input', () => {
      sliderDragging = true;
      const nextScale = Math.max(0.2, Math.min(1.5, Number(scaleSliderEl.value) / 100));
      updateScaleSliderVisual(nextScale);
      void invoke('preview_scale', { scale: nextScale }).catch(() => {});
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
      void invoke('preview_opacity', { opacity: 1.0 }).catch(() => {});
      void applySettingsPatch({ opacity: 1.0 });
    });
  }

  if (!inTauri) return;

  // Pet care: mirror the pet's live state and forward button presses to the
  // main window (the pet itself lives there).
  await listen<PetCareState>('kuro-pet-care-state', (ev) => {
    updatePetCareUI(ev.payload);
  });
  await emit('kuro-pet-care-request', null).catch(() => {});

  await listen<AppSettings>('kuro-settings', (ev) => {
    settings = ev.payload;
    syncUI();
  });

  await listen<CatSkinConfig[]>('kuro-cats', (ev) => {
    if (Array.isArray(ev.payload) && ev.payload.length > 0) {
      catList = ev.payload;
      syncUI();
    }
  });

  await listen<UpdateProgressEvent>('kuro-update-status', (ev) => {
    if (ev.payload.info) {
      cachedUpdateInfo = ev.payload.info;
      updateCheckDegradedUrl = ev.payload.info.checkDegraded
        ? ev.payload.info.releaseUrl || DESKTOPPET_RELEASES_PAGE
        : null;
    }
    if (ev.payload.stage === 'available' && cachedUpdateInfo?.hasUpdate) {
      updateBusy = false;
      renderFooterUpdateState();
    } else if (
      ev.payload.stage === 'downloading' ||
      ev.payload.stage === 'verifying' ||
      ev.payload.stage === 'installing'
    ) {
      updateBusy = true;
      renderFooterUpdateState(t('menu.checking_short'), true);
    } else if (ev.payload.stage === 'up_to_date' || ev.payload.stage === 'error') {
      updateBusy = false;
      if (updateCheckDegradedUrl) renderFooterUpdateState('↗ 打开发布页', false);
      else renderFooterUpdateState();
    }
  });

  await listen('kuro-menu-opened', async () => {
    try {
      const [latestSettings, latestCats, cachedUpd, resolvedLoc] = await Promise.all([
        invoke<AppSettings>('get_settings'),
        invoke<CatSkinConfig[]>('get_cats'),
        invoke<UpdateInfo | null>('get_cached_update_info').catch(() => null),
        invoke<string>('get_resolved_locale').catch(() => ''),
      ]);
      settings = latestSettings;
      if (Array.isArray(latestCats) && latestCats.length > 0) {
        catList = latestCats;
      }
      if (cachedUpd) {
        cachedUpdateInfo = cachedUpd;
        updateCheckDegradedUrl = cachedUpd.checkDegraded
          ? cachedUpd.releaseUrl || DESKTOPPET_RELEASES_PAGE
          : null;
      }
      if (resolvedLoc) {
        resolvedBackendLocale = resolvedLoc;
      }
      syncUI();
      if (updateCheckDegradedUrl) renderFooterUpdateState('↗ 打开发布页', false);
      else renderFooterUpdateState();
      if (tabBodyEl) tabBodyEl.scrollTop = 0;
    } catch {}
  });
}

void bootstrap();
