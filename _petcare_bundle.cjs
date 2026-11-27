"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/petCare.ts
var petCare_exports = {};
__export(petCare_exports, {
  applyPetCareAction: () => applyPetCareAction,
  defaultPetCareState: () => defaultPetCareState,
  getPetCareState: () => getPetCareState,
  petCareNeeds: () => petCareNeeds,
  petCareWarning: () => petCareWarning,
  tickPetCare: () => tickPetCare
});
module.exports = __toCommonJS(petCare_exports);
var STORAGE_KEY = "kurocat_pet_care_v1";
var DECAY_PER_MIN = {
  hunger: 0.9,
  thirst: 1.3,
  mood: 0.7,
  energy: 0.45,
  clean: 0.55
};
var clamp = (v) => Math.max(0, Math.min(100, v));
function defaultPetCareState() {
  return { hunger: 18, thirst: 14, mood: 82, energy: 90, clean: 88, updatedAt: Date.now() };
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPetCareState();
    const parsed = JSON.parse(raw);
    const st = {
      hunger: clamp(Number(parsed.hunger ?? 20)),
      thirst: clamp(Number(parsed.thirst ?? 20)),
      mood: clamp(Number(parsed.mood ?? 80)),
      energy: clamp(Number(parsed.energy ?? 85)),
      clean: clamp(Number(parsed.clean ?? 85)),
      updatedAt: Number(parsed.updatedAt ?? Date.now()) || Date.now()
    };
    return st;
  } catch {
    return defaultPetCareState();
  }
}
function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
  }
}
var currentState = null;
function getPetCareState() {
  if (!currentState) currentState = load();
  return currentState;
}
function tickPetCare(now = Date.now()) {
  const st = getPetCareState();
  const dtMin = Math.max(0, Math.min(240, (now - st.updatedAt) / 6e4));
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
function applyPetCareAction(action, now = Date.now()) {
  const st = tickPetCare(now);
  let effective = false;
  let feedback = "";
  switch (action) {
    case "feed":
      if (st.hunger > 2) effective = true;
      st.hunger = clamp(st.hunger - 38);
      st.thirst = clamp(st.thirst + 4);
      st.mood = clamp(st.mood + 6);
      st.energy = clamp(st.energy + 6);
      feedback = effective ? "\u771F\u597D\u5403\uFF01\u8C22\u8C22\u6295\u5582 \u{1F356}" : "\u5DF2\u7ECF\u5403\u5F97\u9971\u9971\u7684\u5566\u2026";
      break;
    case "drink":
      if (st.thirst > 2) effective = true;
      st.thirst = clamp(st.thirst - 42);
      st.mood = clamp(st.mood + 4);
      feedback = effective ? "\u5495\u549A\u5495\u549A\uFF5E\u8865\u5145\u6C34\u5206 \u{1F4A7}" : "\u8FD8\u4E0D\u6E34\uFF0C\u5148\u653E\u8FD9\u513F\u5427";
      break;
    case "play":
      effective = st.energy > 12;
      st.mood = clamp(st.mood + 26);
      st.energy = clamp(st.energy - 18);
      st.hunger = clamp(st.hunger + 8);
      st.thirst = clamp(st.thirst + 7);
      st.clean = clamp(st.clean - 10);
      feedback = effective ? "\u592A\u597D\u73A9\u5566\uFF01\u518D\u6765\u4E00\u6B21\uFF01\u{1F3BE}" : "\u8DD1\u4E0D\u52A8\u4E86\u2026\u8BA9\u6211\u6B47\u4E00\u4F1A\u513F";
      break;
    case "bath":
      if (st.clean < 96) effective = true;
      st.clean = clamp(st.clean + 48);
      st.mood = clamp(st.mood + 6);
      feedback = effective ? "\u6D17\u5F97\u9999\u9999\u7684\uFF0C\u5E72\u51C0\u53C8\u6F02\u4EAE \u{1F6C1}" : "\u672C\u6765\u5C31\u5F88\u5E72\u51C0\u561B";
      break;
  }
  st.updatedAt = now;
  save(st);
  return { state: st, feedback, effective };
}
var NEED_RULES = [
  {
    action: "feed",
    icon: "\u{1F356}",
    actionLabel: "\u7ACB\u5373\u5582\u98DF",
    warnText: "\u6709\u70B9\u997F\u4E86\uFF0C\u60F3\u5403\u4E1C\u897F \u{1F356}",
    urgentText: "\u809A\u5B50\u5495\u5495\u53EB\u4E86\uFF0C\u5FEB\u5582\u6211\u5403\u996D \u{1F356}",
    severity: (s) => s.hunger >= 55 ? s.hunger : null,
    urgentAt: 82
  },
  {
    action: "drink",
    icon: "\u{1F4A7}",
    actionLabel: "\u7ACB\u5373\u559D\u6C34",
    warnText: "\u6709\u70B9\u6E34\u4E86\uFF0C\u60F3\u559D\u6C34 \u{1F4A7}",
    urgentText: "\u597D\u6E34\u554A\uFF0C\u5FEB\u7ED9\u6211\u6C34\u559D \u{1F4A7}",
    severity: (s) => s.thirst >= 55 ? s.thirst : null,
    urgentAt: 85
  },
  {
    action: "bath",
    icon: "\u{1F6C1}",
    actionLabel: "\u7ACB\u5373\u6D17\u6FA1",
    warnText: "\u8EAB\u4E0A\u6709\u70B9\u810F\uFF0C\u60F3\u6D17\u6FA1 \u{1F6C1}",
    urgentText: "\u8EAB\u4E0A\u75D2\u75D2\u7684\uFF0C\u5FEB\u5E2E\u6211\u6D17\u4E2A\u6FA1 \u{1F6C1}",
    severity: (s) => s.clean <= 45 ? 100 - s.clean : null,
    urgentAt: 78
    // clean <= 22
  },
  {
    action: "play",
    icon: "\u{1F3BE}",
    actionLabel: "\u966A\u6211\u73A9\u800D",
    warnText: "\u6709\u70B9\u65E0\u804A\uFF0C\u60F3\u73A9\u4E00\u4F1A\u513F \u{1F3BE}",
    urgentText: "\u597D\u65E0\u804A\u554A\uFF0C\u966A\u6211\u73A9\u4F1A\u513F\u5427 \u{1F3BE}",
    severity: (s) => s.mood <= 45 ? 100 - s.mood : null,
    urgentAt: 75
    // mood <= 25
  }
];
function petCareNeeds(state) {
  const needs = [];
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
      severity
    });
  }
  needs.sort(
    (a, b) => Number(b.urgent) - Number(a.urgent) || b.severity - a.severity
  );
  return needs;
}
function petCareWarning(state) {
  const needs = petCareNeeds(state);
  return needs.length ? needs[0].text : null;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  applyPetCareAction,
  defaultPetCareState,
  getPetCareState,
  petCareNeeds,
  petCareWarning,
  tickPetCare
});
