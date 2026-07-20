# Re-run the calling husky hook inside nix develop when Node.js is older than 18.
# Sourced at the top of hook scripts; uses $0 (the hook) when re-executing.

if [ -n "${SP331_HUSKY_IN_NIX:-}" ]; then
  return 0 2>/dev/null || exit 0
fi

if node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' 2>/dev/null; then
  return 0 2>/dev/null || exit 0
fi

if ! command -v nix >/dev/null 2>&1; then
  for _nix_bin in \
    "${HOME}/.nix-profile/bin" \
    /nix/var/nix/profiles/default/bin; do
    if [ -x "$_nix_bin/nix" ]; then
      PATH="$_nix_bin:$PATH"
      break
    fi
  done
fi

if ! command -v nix >/dev/null 2>&1; then
  echo "husky: Node.js 18+ is required (found $(node -v 2>/dev/null || echo none))."
  echo "Install Node 20+ or run: nix develop"
  exit 1
fi

_husky_repo="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
if [ ! -f "$_husky_repo/flake.nix" ]; then
  echo "husky: Node.js 18+ is required (found $(node -v 2>/dev/null || echo none))."
  exit 1
fi

export SP331_HUSKY_IN_NIX=1
exec nix develop "$_husky_repo" -c env SP331_HUSKY_IN_NIX=1 sh -e "$0" "$@"
