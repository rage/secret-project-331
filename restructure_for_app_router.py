import argparse
import shutil
from pathlib import Path

# A set of file extensions that the script will consider as pages or API routes.
VALID_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx"}


def migrate_file_structure(pages_dir, app_dir, is_dry_run):
    """
    Migrates the file structure from Next.js Pages Router to App Router conventions.

    Args:
        pages_dir (Path): The path to the source 'pages' directory.
        app_dir (Path): The path to the destination 'app' directory.
        is_dry_run (bool): If True, only print planned actions. Otherwise, execute them.
    """
    if not pages_dir.is_dir():
        print(f"Error: Source directory '{pages_dir}' not found.")
        return

    if not is_dry_run and not app_dir.exists():
        print(f"Creating destination directory: {app_dir}")
        app_dir.mkdir(parents=True, exist_ok=True)

    print(f"Starting migration from '{pages_dir}' to '{app_dir}'...")
    if is_dry_run:
        print("--- DRY RUN MODE: No files will be moved. ---")

    # Walk through all files in the pages directory
    for src_path in sorted(pages_dir.rglob("*")):
        if src_path.is_dir():
            continue

        relative_path = src_path.relative_to(pages_dir)
        dst_path = None

        # --- Rule: Special root files ---
        if relative_path.name in ("_app.tsx", "_app.js"):
            dst_path = app_dir / ("layout" + src_path.suffix)
            print_action(
                src_path,
                dst_path,
                "Root layout (was _app)",
                is_dry_run,
            )
            print(
                "    -> INFO: You must manually merge content from '_document.tsx' into this new root layout."
            )

        elif relative_path.name in ("_document.tsx", "_document.js"):
            print(
                f"[SKIPPED] {src_path}\n"
                "    -> ACTION REQUIRED: Manually merge the contents of this file (e.g., <head> tags, lang attribute) into 'app/layout.tsx'."
            )
            continue  # Do not move this file

        elif relative_path.name in ("_error.tsx", "_error.js"):
            dst_path = app_dir / ("error" + src_path.suffix)
            print_action(src_path, dst_path, "Global error boundary", is_dry_run)

        elif relative_path.name in ("404.tsx", "404.js"):
            dst_path = app_dir / ("not-found" + src_path.suffix)
            print_action(src_path, dst_path, "Not found page", is_dry_run)

        # --- Rule: API Routes ---
        elif "api" in relative_path.parts and src_path.suffix in VALID_EXTENSIONS:
            # e.g., pages/api/hello.ts -> app/api/hello/route.ts
            dst_path = (
                app_dir
                / relative_path.parent
                / relative_path.stem
                / ("route" + src_path.suffix)
            )
            print_action(src_path, dst_path, "API Route", is_dry_run)

        # --- Rule: Standard Pages (including index, static, and dynamic) ---
        elif src_path.suffix in VALID_EXTENSIONS:
            if relative_path.stem == "index":
                # e.g., pages/users/index.tsx -> app/users/page.tsx
                dst_path = app_dir / relative_path.parent / ("page" + src_path.suffix)
                print_action(src_path, dst_path, "Index page", is_dry_run)
            else:
                # e.g., pages/about.tsx -> app/about/page.tsx
                # e.g., pages/blog/[slug].tsx -> app/blog/[slug]/page.tsx
                dst_path = (
                    app_dir
                    / relative_path.parent
                    / relative_path.stem
                    / ("page" + src_path.suffix)
                )
                print_action(src_path, dst_path, "Page", is_dry_run)

        # --- Rule: Unhandled files ---
        else:
            print(
                f"[SKIPPED] {src_path}\n"
                f"    -> WARNING: Unhandled file type. Please move it manually if needed (e.g., to a '_components' folder)."
            )
            continue

        # --- Execute the move if not a dry run ---
        if not is_dry_run and dst_path:
            try:
                dst_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src_path), str(dst_path))
            except Exception as e:
                print(f"    -> ERROR: Failed to move file. {e}")

    print("\n--- Migration planning complete. ---")
    if not is_dry_run:
        print("--- Empty folders may be left in the source directory. ---")


def print_action(src, dest, rule, is_dry_run):
    """Helper to print the planned action in a consistent format."""
    mode = "DRY RUN" if is_dry_run else "MOVE"
    print(f"[{mode}] Applying rule: {rule}")
    print(f"  {src}\n  -> {dest}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Restructure a Next.js 'pages' directory to the 'app' directory convention.",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "--pages-dir",
        type=str,
        default="src/pages",
        help="The source Next.js pages directory.\nDefault: 'src/pages'",
    )
    parser.add_argument(
        "--app-dir",
        type=str,
        default="src/app",
        help="The destination Next.js app directory.\nDefault: 'src/app'",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Actually perform the file move operations.\nDefault is a dry run.",
    )

    args = parser.parse_args()

    # Use pathlib for robust path handling
    source_dir = Path(args.pages_dir)
    destination_dir = Path(args.app_dir)

    migrate_file_structure(source_dir, destination_dir, is_dry_run=not args.write)
