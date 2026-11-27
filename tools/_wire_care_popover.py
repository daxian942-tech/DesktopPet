# -*- coding: utf-8 -*-
"""Wire tap-to-open care popover and need-driven auto reminders into main.ts."""
from pathlib import Path

P = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat/src/main.ts")
raw = P.read_text(encoding="utf-8")

REPLACES = [
    # 1. imports
    (
        "  petCareWarning,\n"
        "  tickPetCare,\n"
        "  type PetCareAction,\n"
        "  type PetCareState,\n",
        "  petCareNeeds,\n"
        "  petCareWarning,\n"
        "  tickPetCare,\n"
        "  type PetCareAction,\n"
        "  type PetCareNeed,\n"
        "  type PetCareState,\n",
    ),
    # 2. DOM references
    (
        "const agentBubbleEl = document.getElementById('agent-bubble') as HTMLDivElement | null;\n",
        "const agentBubbleEl = document.getElementById('agent-bubble') as HTMLDivElement | null;\n"
        "const carePopoverEl = document.getElementById('care-popover') as HTMLDivElement | null;\n"
        "const careAlertEl = document.getElementById('care-pop-alert') as HTMLDivElement | null;\n"
        "const careAlertTextEl = document.getElementById('care-pop-alert-text') as HTMLSpanElement | null;\n"
        "const careAlertActionEl = document.getElementById('care-pop-alert-action') as HTMLButtonElement | null;\n"
        "const careCloseEl = document.getElementById('care-pop-close') as HTMLButtonElement | null;\n",
    ),
    # 3. state + popover helpers (replaces the single lastCareWarnAt declaration)
    (
        "let lastCareWarnAt = 0;\n",
        """let lastCareWarnAt = 0;
let lastCareNeedKey = '';
let carePopoverOpen = false;
let careAlertNeed: PetCareNeed | null = null;

/** Register the popover rect with the Rust hit-test loop so the transparent
 *  window stays clickable over it (same mechanism as the tail picker). */
function syncCarePopoverBounds(): void {
  if (!carePopoverEl) return;
  if (!carePopoverOpen) {
    void invoke('set_care_popover_bounds', { bounds: null }).catch(() => {});
    return;
  }
  const r = carePopoverEl.getBoundingClientRect();
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  const bounds = [r.left / w, r.top / h, r.right / w, r.bottom / h];
  void invoke('set_care_popover_bounds', { bounds }).catch(() => {});
}

function renderCarePopover(state: PetCareState): void {
  if (!carePopoverOpen) return;
  const setBar = (id: string, val: number, invert = false): void => {
    const el = document.getElementById('cpop-' + id);
    if (!el) return;
    const v = invert ? 100 - val : val;
    el.style.width = Math.max(3, v).toFixed(0) + '%';
    el.classList.toggle('cpop-bad', v <= 22);
    el.classList.toggle('cpop-warn', v > 22 && v <= 45);
  };
  setBar('hunger', state.hunger, true);
  setBar('thirst', state.thirst, true);
  setBar('mood', state.mood);
  setBar('energy', state.energy);
  setBar('clean', state.clean);

  const needs = petCareNeeds(state);
  const top = needs[0] ?? null;
  if (careAlertEl && careAlertTextEl && careAlertActionEl) {
    if (top) {
      careAlertEl.classList.remove('hidden');
      careAlertEl.classList.toggle('urgent', top.urgent);
      careAlertTextEl.textContent = `${top.icon} ${top.text}`;
      careAlertActionEl.textContent = top.actionLabel;
    } else {
      careAlertEl.classList.add('hidden');
    }
  }
  carePopoverEl?.querySelectorAll<HTMLButtonElement>('[data-care-action]').forEach((btn) => {
    btn.classList.toggle('is-recommended', Boolean(top) && btn.dataset.careAction === top?.action);
  });
}

function openCarePopover(mode: 'manual' | 'alert', clientX?: number, clientY?: number): void {
  if (!carePopoverEl || settings.clickThroughLocked) return;
  const wasOpen = carePopoverOpen;
  carePopoverOpen = true;
  if (mode === 'alert') careAlertNeed = petCareNeeds(getPetCareState())[0] ?? null;
  carePopoverEl.classList.remove('hidden');
  if (!wasOpen || mode === 'manual') {
    const w = carePopoverEl.offsetWidth || 234;
    const h = carePopoverEl.offsetHeight || 230;
    const cx = clientX ?? window.innerWidth / 2;
    const cy = clientY ?? window.innerHeight * 0.62;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, cx - w / 2));
    const top = Math.max(8, Math.min(window.innerHeight - h - 8, cy - h - 14));
    carePopoverEl.style.left = `${left}px`;
    carePopoverEl.style.top = `${top}px`;
  }
  renderCarePopover(getPetCareState());
  syncCarePopoverBounds();
}

function closeCarePopover(): void {
  if (!carePopoverOpen) return;
  carePopoverOpen = false;
  careAlertNeed = null;
  carePopoverEl?.classList.add('hidden');
  syncCarePopoverBounds();
}

carePopoverEl?.addEventListener('mousedown', (e) => e.stopPropagation());
carePopoverEl?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-care-action]');
  if (!btn) return;
  e.stopPropagation();
  const action = btn.dataset.careAction ?? '';
  if (isPetCareAction(action)) performPetCareAction(action);
});
careCloseEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  closeCarePopover();
});
careAlertActionEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  const need = careAlertNeed ?? petCareNeeds(getPetCareState())[0];
  if (need) performPetCareAction(need.action);
});
""",
    ),
    # 4. refresh popover + reset reminder cooldown after any care action
    (
        "  agentCompanion.handleEvent({\n"
        "    kind: res.effective ? 'action' : 'bubble',\n"
        "    action: 'happy',\n"
        "    source: 'pet-care',\n"
        "    text: res.feedback,\n"
        "    ttlMs: 3200,\n"
        "  });\n"
        "  void emit('kuro-pet-care-state', res.state).catch(() => {});\n"
        "}\n",
        "  agentCompanion.handleEvent({\n"
        "    kind: res.effective ? 'action' : 'bubble',\n"
        "    action: 'happy',\n"
        "    source: 'pet-care',\n"
        "    text: res.feedback,\n"
        "    ttlMs: 3200,\n"
        "  });\n"
        "  void emit('kuro-pet-care-state', res.state).catch(() => {});\n"
        "  renderCarePopover(res.state);\n"
        "  // A newly appeared need may speak up right away after the user finishes this action.\n"
        "  lastCareWarnAt = 0;\n"
        "  lastCareNeedKey = '';\n"
        "}\n",
    ),
    # 5. need-driven ticker
    (
        "function startPetCareTicker(): void {\n"
        "  const tick = (): void => {\n"
        "    const st = tickPetCare();\n"
        "    updatePetCareUI(st);\n"
        "    void emit('kuro-pet-care-state', st).catch(() => {});\n"
        "    const warn = petCareWarning(st);\n"
        "    if (warn && Date.now() - lastCareWarnAt > 10 * 60_000) {\n"
        "      lastCareWarnAt = Date.now();\n"
        "      agentCompanion.handleEvent({ kind: 'bubble', source: 'pet-care', text: warn, ttlMs: 5200 });\n"
        "    }\n"
        "  };\n"
        "  window.setTimeout(tick, 6_000);\n"
        "  window.setInterval(tick, 60_000);\n"
        "}\n"
        "updatePetCareUI(getPetCareState());\n"
        "startPetCareTicker();\n",
        """function startPetCareTicker(): void {
  const tick = (): void => {
    const st = tickPetCare();
    updatePetCareUI(st);
    renderCarePopover(st);
    void emit('kuro-pet-care-state', st).catch(() => {});

    const needs = petCareNeeds(st);
    const top = needs[0] ?? null;
    const key = top ? `${top.action}:${top.urgent ? 1 : 0}` : '';
    const levelChanged = key !== lastCareNeedKey;
    lastCareNeedKey = key;
    if (!top) return;

    // Speak up as soon as a need appears or worsens, then stay quiet for a while.
    const interval = top.urgent ? 3 * 60_000 : 10 * 60_000;
    if (!levelChanged && Date.now() - lastCareWarnAt <= interval) return;
    lastCareWarnAt = Date.now();
    careAlertNeed = top;
    agentCompanion.handleEvent({
      kind: 'bubble',
      source: 'pet-care',
      text: `${top.text} · ${top.actionLabel}`,
      ttlMs: 6500,
    });
    openCarePopover('alert');
  };
  window.setTimeout(tick, 6_000);
  window.setInterval(tick, 30_000);
}
updatePetCareUI(getPetCareState());
startPetCareTicker();
""",
    ),
    # 6. resize
    (
        "window.addEventListener('resize', () => engine3d?.resize());\n",
        "window.addEventListener('resize', () => {\n"
        "  engine3d?.resize();\n"
        "  syncCarePopoverBounds();\n"
        "});\n",
    ),
    # 7. dismiss popover on any canvas press
    (
        "  const handleCanvasMouseDown = async (e: MouseEvent) => {\n"
        "    if (e.button !== 0) return;\n"
        "    closeContextMenu();\n"
        "    if (tailPickerOpen) {\n",
        "  const handleCanvasMouseDown = async (e: MouseEvent) => {\n"
        "    if (e.button !== 0) return;\n"
        "    closeContextMenu();\n"
        "    closeCarePopover();\n"
        "    if (tailPickerOpen) {\n",
    ),
    # 8. Windows/macOS quick tap opens the panel when it hits the pet
    (
        "      if (dist < DRAG_THRESHOLD_PX && dt <= TAP_MAX_MS) {\n"
        "        if (active3d && engine3d) engine3d.onCatTapAtClientPoint(downX, downY);\n"
        "        else engine.onCatTapAtClientPoint(downX, downY);\n"
        "      }\n",
        "      if (dist < DRAG_THRESHOLD_PX && dt <= TAP_MAX_MS) {\n"
        "        const zone =\n"
        "          active3d && engine3d\n"
        "            ? engine3d.onCatTapAtClientPoint(downX, downY)\n"
        "            : engine.onCatTapAtClientPoint(downX, downY);\n"
        "        if (zone) openCarePopover('manual', downX, downY);\n"
        "      }\n",
    ),
    # 9. Linux nose/tail tap opens the panel too
    (
        "      if (zone === 'nose' || zone === 'tail') {\n"
        "        if (active3d && engine3d) engine3d.onCatTapAtClientPoint(downX, downY);\n"
        "        else engine.onCatTapAtClientPoint(downX, downY);\n"
        "        return;\n"
        "      }\n",
        "      if (zone === 'nose' || zone === 'tail') {\n"
        "        if (active3d && engine3d) engine3d.onCatTapAtClientPoint(downX, downY);\n"
        "        else engine.onCatTapAtClientPoint(downX, downY);\n"
        "        openCarePopover('manual', downX, downY);\n"
        "        return;\n"
        "      }\n",
    ),
    # 10. right-click closes the popover before opening the menu
    (
        "  const handleCanvasContextMenu = (e: MouseEvent) => {\n"
        "    e.preventDefault();\n"
        "    if (tailPickerSaving) return;\n",
        "  const handleCanvasContextMenu = (e: MouseEvent) => {\n"
        "    e.preventDefault();\n"
        "    closeCarePopover();\n"
        "    if (tailPickerSaving) return;\n",
    ),
    # 11. Escape closes the popover
    (
        "    } else if (e.key === 'Escape') {\n"
        "      closeContextMenu();\n"
        "    }\n",
        "    } else if (e.key === 'Escape') {\n"
        "      closeContextMenu();\n"
        "      closeCarePopover();\n"
        "    }\n",
    ),
]

for i, (old, new) in enumerate(REPLACES, 1):
    n = raw.count(old)
    if n != 1:
        raise SystemExit("replace #%d expected 1 occurrence, found %d\n---\n%s" % (i, n, old[:240]))
    raw = raw.replace(old, new, 1)
    print("replace #%d ok" % i)

P.write_text(raw, encoding="utf-8", newline="")
print("main.ts updated")
