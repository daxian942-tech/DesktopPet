# -*- coding: utf-8 -*-
"""Register the pet-care popover as an interactive hit-test region in the Rust backend."""
from pathlib import Path

P = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat/src-tauri/src/lib.rs")
raw = P.read_text(encoding="utf-8")

REPLACES = [
    # 1. AppState field
    (
        "    tail_picker_bounds: Arc<Mutex<Option<TailPickerBounds>>>,\n",
        "    tail_picker_bounds: Arc<Mutex<Option<TailPickerBounds>>>,\n"
        "    /// Normalized [left, top, right, bottom] of the pet-care popover, when visible.\n"
        "    care_popover_bounds: Arc<Mutex<Option<[f64; 4]>>>,\n",
    ),
    # 2. new tauri command
    (
        "#[tauri::command]\n"
        "fn set_tail_picker_bounds(state: State<'_, AppState>, bounds: Option<TailPickerBounds>) {\n"
        "    *state.tail_picker_bounds.lock().unwrap() = bounds;\n"
        "}\n",
        "#[tauri::command]\n"
        "fn set_tail_picker_bounds(state: State<'_, AppState>, bounds: Option<TailPickerBounds>) {\n"
        "    *state.tail_picker_bounds.lock().unwrap() = bounds;\n"
        "}\n"
        "\n"
        "#[tauri::command]\n"
        "fn set_care_popover_bounds(state: State<'_, AppState>, bounds: Option<[f64; 4]>) {\n"
        "    *state.care_popover_bounds.lock().unwrap() = bounds;\n"
        "}\n",
    ),
    # 3. hit-test loop: clone the shared state
    (
        "    let tail_picker_bounds = app.state::<AppState>().tail_picker_bounds.clone();\n"
        "    let peek_edge_state = app.state::<AppState>().peek_edge.clone();\n",
        "    let tail_picker_bounds = app.state::<AppState>().tail_picker_bounds.clone();\n"
        "    let care_popover_bounds = app.state::<AppState>().care_popover_bounds.clone();\n"
        "    let peek_edge_state = app.state::<AppState>().peek_edge.clone();\n",
    ),
    # 4. hit-test loop: read bounds every tick and compute over_care
    (
        "            let is_menu = menu_open.load(Ordering::Relaxed);\n"
        "            let picker_bounds = *tail_picker_bounds.lock().unwrap();\n",
        "            let is_menu = menu_open.load(Ordering::Relaxed);\n"
        "            let picker_bounds = *tail_picker_bounds.lock().unwrap();\n"
        "            let care_bounds = *care_popover_bounds.lock().unwrap();\n"
        "            let care_open = care_bounds.is_some();\n"
        "            let over_care = inside\n"
        "                && care_bounds.map_or(false, |b| {\n"
        "                    rx >= b[0] && rx <= b[2] && ry >= b[1] && ry <= b[3]\n"
        "                });\n",
    ),
    # 5. Windows native-drag fallback suppression while popover is open
    (
        "                if is_drag\n"
        "                    || is_win7_ulw\n"
        "                    || effective_locked\n"
        "                    || is_menu\n"
        "                    || is_banner\n"
        "                    || picker_bounds.is_some()\n"
        "                {\n",
        "                if is_drag\n"
        "                    || is_win7_ulw\n"
        "                    || effective_locked\n"
        "                    || is_menu\n"
        "                    || is_banner\n"
        "                    || picker_bounds.is_some()\n"
        "                    || care_open\n"
        "                {\n",
    ),
    # 6. keep the window clickable over the popover
    (
        "            let should_ignore = if is_drag || win_drag_armed || over_banner || over_tail_picker {\n",
        "            let should_ignore = if is_drag\n"
        "                || win_drag_armed\n"
        "                || over_banner\n"
        "                || over_tail_picker\n"
        "                || over_care\n"
        "            {\n",
    ),
    # 7. macOS native-drag fallback suppression
    (
        "                if is_drag || effective_locked || is_menu || is_banner || picker_bounds.is_some() {\n",
        "                if is_drag\n"
        "                    || effective_locked\n"
        "                    || is_menu\n"
        "                    || is_banner\n"
        "                    || picker_bounds.is_some()\n"
        "                    || care_open\n"
        "                {\n",
    ),
    # 8. faster hit-test polling while popover is open
    (
        "                || is_menu\n"
        "                || picker_bounds.is_some()\n"
        "                || alt_override\n",
        "                || is_menu\n"
        "                || picker_bounds.is_some()\n"
        "                || care_open\n"
        "                || alt_override\n",
    ),
    # 9. AppState initialization
    (
        "            tail_picker_bounds: Arc::new(Mutex::new(None)),\n",
        "            tail_picker_bounds: Arc::new(Mutex::new(None)),\n"
        "            care_popover_bounds: Arc::new(Mutex::new(None)),\n",
    ),
    # 10. register command
    (
        "            set_menu_open,\n"
        "            set_tail_picker_bounds,\n",
        "            set_menu_open,\n"
        "            set_tail_picker_bounds,\n"
        "            set_care_popover_bounds,\n",
    ),
]

for i, (old, new) in enumerate(REPLACES, 1):
    n = raw.count(old)
    if n != 1:
        raise SystemExit("replace #%d expected 1 occurrence, found %d\n---\n%s" % (i, n, old[:200]))
    raw = raw.replace(old, new, 1)
    print("replace #%d ok" % i)

P.write_text(raw, encoding="utf-8", newline="")
print("lib.rs updated")
