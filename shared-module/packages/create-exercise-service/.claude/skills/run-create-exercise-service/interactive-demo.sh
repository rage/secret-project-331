#!/usr/bin/env bash
# Drives the REAL interactive create-exercise-service CLI (the @inquirer/prompts surface) under tmux,
# answering each prompt, and asserts it scaffolds. Use this when a change touches the prompt flow
# itself; for everything else the faster `smoke.mjs` is enough.
#
# Usage: ./interactive-demo.sh [output-dir]
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
if [ -n "${1:-}" ]; then
  OUT="$1"
  CLEANUP=false
else
  OUT="$(mktemp -u "${TMPDIR:-/tmp}/ces-interactive-XXXX")"
  CLEANUP=true
fi
NAME="interactive-exercise"
SESSION="ces-demo-$$"

echo "pkg: $PKG_ROOT"
echo "out: $OUT"

command -v tmux >/dev/null || { echo "tmux is required"; exit 1; }
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -x 200 -y 50
tmux send-keys -t "$SESSION" "cd $PKG_ROOT && pnpm start" Enter
sleep 5                                                   # tsx boots + prompt 1 renders
tmux send-keys -t "$SESSION" "$NAME" Enter;   sleep 2     # 1. Project name
tmux send-keys -t "$SESSION" "$OUT" Enter;    sleep 2     # 2. Path (explicit; overrides the default)
tmux send-keys -t "$SESSION" Enter;           sleep 1     # 3. Project type -> React (default)
tmux send-keys -t "$SESSION" Enter;           sleep 1     # 4. Package manager -> pnpm (default)
tmux send-keys -t "$SESSION" "3011" Enter;    sleep 1     # 5. Dev server port
tmux send-keys -t "$SESSION" "y" Enter;       sleep 6     # 6. Confirm (default is No)

PANE="$(tmux capture-pane -t "$SESSION" -p)"
tmux kill-session -t "$SESSION" 2>/dev/null || true

echo "----- final CLI output -----"
echo "$PANE" | grep -v '^$' | tail -12

fail=0
echo "$PANE" | grep -q "Done! Created exercise service \"$NAME\"" || { echo "FAIL: no Done! line"; fail=1; }
grep -q "\"name\": \"$NAME\"" "$OUT/package.json" || { echo "FAIL: package.json name not set"; fail=1; }
grep -q "rsbuild dev --port 3011" "$OUT/package.json" || { echo "FAIL: port not applied"; fail=1; }

if $CLEANUP; then
  rm -rf "$OUT"
else
  echo "kept: $OUT"
fi
[ "$fail" -eq 0 ] && echo "PASS" || { echo "FAILED"; exit 1; }
