"""Rebuild the migration bundle with the latest source, deliverables and
cross-account handover files.

The conversation archive is split into two complementary parts: the pre-compact
session already stored in the bundle (part 01) and the current session (part 02,
refreshed from the live transcript on every run). They are different session IDs,
not duplicates.
"""
import zipfile
from pathlib import Path

root = Path(r"C:/Users/23248/WorkBuddy/spaces/2026_11_27_10-33-55/KuroCat")
out = root / "交付产物" / "DesktopPet-项目迁移包.zip"
transcript = Path(
    r"C:/Users/23248/.workbuddy/projects/"
    r"c-Users-23248-WorkBuddy-spaces-2026_11_27_10-33-55-KuroCat-交付产物/"
    r"1b4ed9f7-4f48-4a16-8055-72f3c4bb6074.jsonl"
)

PREFIX = "DesktopPet/_迁移备份/"
LEGACY = PREFIX + "本次完整对话.jsonl"
PART1 = PREFIX + "本次完整对话-01.jsonl"
PART2 = PREFIX + "本次完整对话-02.jsonl"

# Preserve everything already in _迁移备份/ (account memory, earlier session).
with zipfile.ZipFile(out) as z:
    backups = {n: z.read(n) for n in z.namelist() if "_迁移备份/" in n}

# One-time rename of the legacy single-file archive -> part 01.
if LEGACY in backups:
    backups[PART1] = backups.pop(LEGACY)
# Always refresh part 02 with the current session's live transcript.
if transcript.exists():
    backups[PART2] = transcript.read_bytes()
else:
    print(f"WARN: live transcript missing: {transcript}")

skip = {
    "node_modules", "target", ".git", "__pycache__",
    # 验收过程的中间截图目录（最终成图都在 交付产物/ 里）
    "_expr3d", "_expr2d", "_kb_shots", "_flat_typing", "_species_shots",
    "_video_probe", "_ui_shots", "_update_shots", "_care_shots",
    "_motions", "_redraw2d", "_redraw3d", "_redraw3d_typing", "_hand_pose",
    "_keyboard_shots",
}
exclude_names = {out.name, "_migration_old.zip", "_DesktopPet-绿色版-旧版备份.exe"}

with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root)
        if any(part in skip for part in rel.parts):
            continue
        if path.name in exclude_names:
            continue
        # Throwaway crops / intermediate renders at the project root. The final
        # acceptance sheets are kept in 交付产物/.
        if rel.parent == Path(".") and path.name.startswith("_") and path.suffix.lower() in {".png", ".html"}:
            continue
        if path.is_file():
            z.write(path, f"DesktopPet/{rel.as_posix()}")
    for name, data in backups.items():
        z.writestr(name, data)

with zipfile.ZipFile(out) as z:
    bad = z.testzip()
    parts = [n for n in z.namelist() if "_迁移备份/" in n]
    print(f"entries={len(z.namelist())} size={out.stat().st_size} testzip={bad}")
    for n in parts:
        print(f"  {n}  {z.getinfo(n).file_size} bytes")
