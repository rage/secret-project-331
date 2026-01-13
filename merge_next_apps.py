#!/usr/bin/env python3
"""
Merge services/course-material into services/main-frontend with namespacing.

App router:
  SOURCE src/app/**  -> TARGET src/app/org/[organizationSlug]/(course-material)/**
  (but SOURCE src/app/api/** -> TARGET src/app/api/** unchanged)

Other folders under SOURCE src/:
  For each top-level dir D != "app":
    SOURCE src/D/** -> TARGET src/D/course-material/**

Files directly under SOURCE src/:
  SOURCE src/<file> -> TARGET src/course-material/<file>

Public:
  SOURCE public/** -> TARGET public/course-material/**

Everything else at repo root:
  Copy as-is into TARGET (config conflicts captured).

Conflicts:
  Copied to services/main-frontend/_merge_conflicts/course-material/<DEST-RELATIVE-PATH>

Outputs:
  - services/main-frontend/MERGE_REPORT.md
  - services/main-frontend/package.merged.from_course-material.json
"""

import argparse
import filecmp
import json
import os
from pathlib import Path
import shutil
import sys
from datetime import datetime

SRC_DEFAULT = Path("services/course-material")
DST_DEFAULT = Path("services/main-frontend")

IGNORE_DIRS = {
    "node_modules", ".next", ".turbo", ".vercel", ".git",
    "coverage", "dist", "build", ".cache", ".DS_Store"
}

CONFIG_FILES = [
    "next.config.js", "next.config.mjs", "next.config.ts",
    "tsconfig.json", "jsconfig.json",
    ".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json",
    "postcss.config.js", "postcss.config.cjs",
    "tailwind.config.js", "tailwind.config.cjs", "tailwind.config.ts",
    ".prettierrc", ".prettierrc.js", ".prettierrc.cjs", ".prettierrc.json",
    ".env", ".env.local", ".env.development", ".env.production",
]

def same_file(a: Path, b: Path) -> bool:
    try:
        if a.stat().st_size != b.stat().st_size:
            return False
        return filecmp.cmp(a, b, shallow=False)
    except FileNotFoundError:
        return False

def should_ignore(p: Path) -> bool:
    return any(part in IGNORE_DIRS for part in p.parts)

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def copy_with_conflict(src: Path, dst: Path, conflicts_root: Path, report: list, dry_run: bool, dst_root: Path):
    rel = dst.relative_to(dst_root)
    if not dst.exists():
        report.append(f"- add {rel.as_posix()}")
        if not dry_run:
            ensure_dir(dst.parent)
            shutil.copy2(src, dst)
        return "copied"
    if same_file(src, dst):
        report.append(f"- keep {rel.as_posix()} (identical)")
        return "identical"
    alt = conflicts_root / rel
    report.append(f"- conflict {rel.as_posix()} -> {alt}")
    if not dry_run:
        ensure_dir(alt.parent)
        shutil.copy2(src, alt)
    return "conflict"

def merge_package_json(src_pkg: Path, dst_pkg: Path, out_pkg: Path, report: list, dry_run: bool):
    if not src_pkg.exists() or not dst_pkg.exists():
        report.append("- package.json merge: skipped (missing one side).")
        return
    try:
        src = json.loads(src_pkg.read_text(encoding="utf-8"))
        dst = json.loads(dst_pkg.read_text(encoding="utf-8"))
    except Exception as e:
        report.append(f"- package.json merge: error reading JSON: {e}")
        return

    merged = dict(dst)
    dep_sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]
    dep_conflicts = []
    for sec in dep_sections:
        s = src.get(sec, {}) or {}
        d = dst.get(sec, {}) or {}
        out = dict(d)
        for k, v in s.items():
            if k not in out:
                out[k] = v
            elif out[k] != v:
                dep_conflicts.append((sec, k, v, out[k]))  # keep target
        if out:
            merged[sec] = out

    s_scripts = src.get("scripts", {}) or {}
    d_scripts = dst.get("scripts", {}) or {}
    out_scripts = dict(d_scripts)
    sc_conf = []
    for name, cmd in s_scripts.items():
        if name not in out_scripts:
            out_scripts[name] = cmd
        elif out_scripts[name] != cmd:
            alt = f"cm:{name}"
            out_scripts[alt] = cmd
            sc_conf.append((name, cmd, out_scripts[name], alt))
    if out_scripts:
        merged["scripts"] = out_scripts

    if dep_conflicts:
        report.append("- package.json dependency version conflicts (kept TARGET's version):")
        for sec, k, sv, dv in dep_conflicts:
            report.append(f"    · {sec}.{k}: SOURCE='{sv}' TARGET='{dv}'")
    if sc_conf:
        report.append("- package.json script conflicts (kept TARGET; added SOURCE as prefixed):")
        for name, sv, dv, alt in sc_conf:
            report.append(f"    · scripts.{name}: TARGET='{dv}', SOURCE kept as '{alt}' -> '{sv}'")

    if not dry_run:
        out_pkg.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")
    report.append(f"- package.json merged -> {out_pkg}")

def detect_app_path(base: Path) -> Path:
    return base / "src" / "app" if (base / "src" / "app").exists() else base / "app"

def main():
    ap = argparse.ArgumentParser(description="Merge course-material into main-frontend with namespacing")
    ap.add_argument("--source", default=str(SRC_DEFAULT))
    ap.add_argument("--target", default=str(DST_DEFAULT))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    src_root = Path(args.source).resolve()
    dst_root = Path(args.target).resolve()
    if not src_root.exists(): print(f"ERROR: Source not found: {src_root}", file=sys.stderr); sys.exit(1)
    if not dst_root.exists(): print(f"ERROR: Target not found: {dst_root}", file=sys.stderr); sys.exit(1)

    src_app = detect_app_path(src_root)
    dst_app = detect_app_path(dst_root)

    # Where app content goes
    group_root = dst_app / "org" / "[organizationSlug]" / "(course-material)"
    dst_api_root = dst_app / "api"

    conflicts_root = dst_root / "_merge_conflicts" / "course-material"
    conflicts_cfg = dst_root / "_merge_conflicts" / "config"
    report_path = dst_root / "MERGE_REPORT.md"

    report = [
        "# Merge Report",
        f"- Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"- SOURCE: {src_root}",
        f"- TARGET: {dst_root}",
        "",
        "## Summary",
        "- App routes -> `src/app/org/[organizationSlug]/(course-material)/**` (keeping `/api` at `src/app/api/**`).",
        "- Other `src/<dir>` -> `src/<dir>/course-material/**`.",
        "- Files under `src/` -> `src/course-material/<file>`.",
        "- Public -> `public/course-material/**`.",
        "- Conflicts captured under `_merge_conflicts/`.",
        "",
        "## Config files",
    ]

    # Merge package.json to sidefile
    merge_package_json(
        src_root / "package.json",
        dst_root / "package.json",
        dst_root / "package.merged.from_course-material.json",
        report,
        args.dry_run,
    )

    # Config files copy/conflict
    for name in CONFIG_FILES:
        s = src_root / name
        if not s.exists(): continue
        d = dst_root / name
        if not d.exists():
            report.append(f"- add {name}")
            if not args.dry_run:
                ensure_dir(d.parent); shutil.copy2(s, d)
        else:
            if same_file(s, d):
                report.append(f"- keep {name} (identical)")
            else:
                alt = conflicts_cfg / name
                report.append(f"- conflict {name} -> {alt}")
                if not args.dry_run:
                    ensure_dir(alt.parent); shutil.copy2(s, alt)

    report += ["", "## Files & directories"]
    copied = identical = conflicts = 0
    def tally(x: str):
        nonlocal copied, identical, conflicts
        if x == "copied": copied += 1
        elif x == "identical": identical += 1
        elif x == "conflict": conflicts += 1

    # 1) Public -> public/course-material/**
    if (src_root / "public").exists():
        for root, dirs, files in os.walk(src_root / "public"):
            root_path = Path(root)
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            rel = root_path.relative_to(src_root / "public")
            dst_dir = (dst_root / "public" / "course-material" / rel)
            for f in files:
                s = root_path / f
                if should_ignore(s): continue
                d = dst_dir / f
                tally(copy_with_conflict(s, d, conflicts_root, report, args.dry_run, dst_root))

    # 2) App -> org/[organizationSlug]/(course-material)/** (api/** kept at root)
    if src_app.exists():
        for root, dirs, files in os.walk(src_app):
            root_path = Path(root)
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            rel = root_path.relative_to(src_app)

            if rel.parts and rel.parts[0] == "api":
                # keep api at root
                dst_dir = dst_api_root.joinpath(*rel.parts[1:]) if len(rel.parts) > 1 else dst_api_root
            elif rel == Path("."):
                dst_dir = group_root
            elif rel.parts and rel.parts[0] == "[organizationSlug]":
                dst_dir = group_root.joinpath(*rel.parts[1:])
            else:
                dst_dir = group_root.joinpath(*rel.parts)

            for f in files:
                s = root_path / f
                if should_ignore(s): continue
                # top-level special files
                if rel == Path(".") and f in ("layout.tsx", "not-found.tsx"):
                    d = group_root / f
                else:
                    d = dst_dir / f
                tally(copy_with_conflict(s, d, conflicts_root, report, args.dry_run, dst_root))

    # 3) Other src/* dirs -> src/<dir>/course-material/**
    src_src = src_root / "src"
    if src_src.exists():
        # collect top-level entries under src
        for entry in src_src.iterdir():
            if entry.name == "app":
                continue
            if should_ignore(entry):
                continue
            if entry.is_dir():
                for root, dirs, files in os.walk(entry):
                    root_path = Path(root)
                    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
                    rel = root_path.relative_to(entry)
                    dst_dir = dst_root / "src" / entry.name / "course-material" / rel
                    for f in files:
                        s = root_path / f
                        if should_ignore(s): continue
                        d = dst_dir / f
                        tally(copy_with_conflict(s, d, conflicts_root, report, args.dry_run, dst_root))
            else:
                # a file directly under src/ (rare) -> src/course-material/<file>
                dst_dir = dst_root / "src" / "course-material"
                d = dst_dir / entry.name
                tally(copy_with_conflict(entry, d, conflicts_root, report, args.dry_run, dst_root))

    # 4) Everything else at source root (excluding src/, public/, app/)
    for entry in src_root.iterdir():
        if entry.name in {"src", "public", "app"}:
            continue
        if should_ignore(entry): continue

        if entry.is_dir():
            for root, dirs, files in os.walk(entry):
                root_path = Path(root)
                dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
                for f in files:
                    s = root_path / f
                    if should_ignore(s): continue
                    rel = s.relative_to(src_root)
                    d = dst_root / rel
                    tally(copy_with_conflict(s, d, conflicts_root, report, args.dry_run, dst_root))
        else:
            rel = entry.relative_to(src_root)
            d = dst_root / rel
            tally(copy_with_conflict(entry, d, conflicts_root, report, args.dry_run, dst_root))

    report += [
        "",
        "## Follow-up notes",
        "- Routes now under `src/app/org/[organizationSlug]/(course-material)/**`.",
        "- Namespaced libs/components/hooks/etc. under `src/<dir>/course-material/**`.",
        "- Files directly under `src/` placed at `src/course-material/`.",
        "- Public assets under `public/course-material/`.",
        "- Review `package.merged.from_course-material.json`, then replace `package.json` and reinstall deps if desired.",
        "",
        "## Stats",
        f"- copied: {copied}",
        f"- identical: {identical}",
        f"- conflicts: {conflicts}",
    ]

    if not args.dry_run:
        ensure_dir(report_path.parent)
        report_path.write_text("\n".join(report) + "\n", encoding="utf-8")

    print(f"Done. {'(dry-run)' if args.dry_run else ''}")
    print(f"- Report: {report_path}")
    print(f"- Merged package: {dst_root / 'package.merged.from_course-material.json'}")
    if conflicts:
        print(f"- Conflicts directory: {conflicts_root}")

if __name__ == "__main__":
    main()
