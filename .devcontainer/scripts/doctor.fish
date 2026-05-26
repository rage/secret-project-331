#!/usr/bin/env fish

set -l script_dir (cd (dirname (status --current-filename)); and pwd)
set -l repo_root (realpath "$script_dir/../..")
set -g fail_count 0
set -g warn_count 0

set -gx NIX_CONFIG "experimental-features = nix-command flakes"
set -gx TILT_DISABLE_ANALYTICS 1

function add_nix_paths
    if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
        source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
    end

    if test -d /nix/var/nix/profiles/default/bin
        fish_add_path -m /nix/var/nix/profiles/default/bin
    end

    if test -d "$HOME/.nix-profile/bin"
        fish_add_path -m "$HOME/.nix-profile/bin"
    end
end

function usage
    echo "Usage: .devcontainer/scripts/doctor.fish [--prereq]"
    echo ""
    echo "Checks whether the devcontainer is ready for the Kind/Tilt workflow."
    echo "--prereq keeps the same checks and exits non-zero only for hard failures."
end

add_nix_paths

for arg in $argv
    switch "$arg"
        case --prereq
            true
        case -h --help
            usage
            exit 0
        case '*'
            echo "Unknown option: $arg" >&2
            usage >&2
            exit 2
    end
end

function print_status --argument-names level label detail
    set -l color_normal (set_color normal)
    set -l color
    switch "$level"
        case OK
            set color (set_color green)
        case WARN
            set color (set_color yellow)
        case FAIL
            set color (set_color red)
        case '*'
            set color (set_color normal)
    end

    printf "%s%-4s%s %s" "$color" "$level" "$color_normal" "$label"
    if test -n "$detail"
        printf " - %s" "$detail"
    end
    printf "\n"
end

function ok --argument-names label detail
    print_status OK "$label" "$detail"
end

function warn --argument-names label detail
    set -g warn_count (math $warn_count + 1)
    print_status WARN "$label" "$detail"
end

function fail --argument-names label detail
    set -g fail_count (math $fail_count + 1)
    print_status FAIL "$label" "$detail"
end

function first_line --argument-names file
    set -l line (head -n 1 "$file" 2>/dev/null | string trim)
    if test -n "$line"
        echo "$line"
    end
end

function run_check
    set -l label $argv[1]
    set -e argv[1]
    set -l output_file (mktemp)

    if $argv >"$output_file" 2>&1
        ok "$label" (first_line "$output_file")
        rm -f "$output_file"
        return 0
    else
        fail "$label" (first_line "$output_file")
        rm -f "$output_file"
        return 1
    end
end

function run_warn_check
    set -l label $argv[1]
    set -e argv[1]
    set -l output_file (mktemp)

    if $argv >"$output_file" 2>&1
        ok "$label" (first_line "$output_file")
        rm -f "$output_file"
        return 0
    else
        warn "$label" (first_line "$output_file")
        rm -f "$output_file"
        return 1
    end
end

function run_nix_check
    set -l label $argv[1]
    set -e argv[1]
    run_check "$label" nix develop "$repo_root" --command $argv
end

function run_nix_warn_check
    set -l label $argv[1]
    set -e argv[1]
    run_warn_check "$label" nix develop "$repo_root" --command $argv
end

function check_port --argument-names port label
    if not command -q ss
        warn "$label port $port" "ss is unavailable; cannot inspect listeners"
        return
    end

    if ss -ltnH "sport = :$port" | string match -q "*:$port*"
        fail "$label port $port" "already listening"
    else
        ok "$label port $port" "not currently listening; available for local port-forward"
    end
end

cd "$repo_root"

if test (id -u) -eq 0
    fail "Non-root user" "repo scripts refuse to run as root"
else
    ok "Non-root user" (id -un)
end

if test -f "$repo_root/flake.nix"
    ok "Nix flake" "$repo_root/flake.nix"
else
    fail "Nix flake" "flake.nix is missing"
end

if command -q nix
    run_check "Nix" nix --version
    run_check "nix develop" nix develop "$repo_root" --command true
else
    fail "Nix" "nix is not installed or is not in PATH"
end

if command -q direnv
    run_check "direnv" direnv --version
    run_warn_check "direnv allow" direnv exec "$repo_root" true
else
    warn "direnv" "direnv is not installed or is not in PATH"
end

if test -S /var/run/docker.sock
    ok "Docker socket" "/var/run/docker.sock"
else
    fail "Docker socket" "/var/run/docker.sock is missing"
end

if command -q docker
    run_check "Docker CLI" docker --version
    run_check "Docker daemon access" docker info
else
    fail "Docker CLI" "docker is not installed or is not in PATH"
end

if command -q nix
    run_nix_check "Rust" rustc --version
    run_nix_check "Node" node --version
    run_nix_check "pnpm" pnpm --version
    run_nix_check "kind" kind version
    run_nix_check "ctlptl" ctlptl version
    run_nix_check "tilt" tilt version
    run_nix_check "kubectl" kubectl version --client
    run_nix_check "skaffold" skaffold version
    run_nix_warn_check "Kind context kind-kind" kubectl config get-contexts kind-kind
end

set -l secret_files \
    "$repo_root/kubernetes/dev/headless-lms/env-local-patch.secret.yml" \
    "$repo_root/kubernetes/test/headless-lms/env-local-patch.secret.yml"
set -l missing_secrets
for file in $secret_files
    if not test -f "$file"
        set -a missing_secrets "$file"
    end
end
if test (count $missing_secrets) -eq 0
    ok "Local secret patch files" "present"
else
    warn "Local secret patch files" "missing; run .devcontainer/scripts/ensure-local-secrets.fish"
end

if test -r /proc/sys/fs/inotify/max_user_watches
    set -l watches (cat /proc/sys/fs/inotify/max_user_watches)
    set -l min_watches 500000
    if test "$watches" -ge "$min_watches"
        ok "inotify max_user_watches" "$watches"
    else
        fail "inotify max_user_watches" "$watches is below required $min_watches"
    end
else
    warn "inotify max_user_watches" "not readable on this platform"
end

set -l tmc_binary (find "$repo_root/services/tmc/bin" -maxdepth 1 -type f -name 'tmc-langs-cli-*' -print -quit 2>/dev/null)
if test -n "$tmc_binary"
    ok "TMC langs CLI" "$tmc_binary"
else
    warn "TMC langs CLI" "missing; bin/devcontainer-up can run bin/tmc-langs-setup"
end

set -l playwright_binary (find "$HOME/.cache/ms-playwright" -maxdepth 2 -type f \( -name 'playwright.sh' -o -name 'chrome' -o -name 'chromium' \) -print -quit 2>/dev/null)
if test -n "$playwright_binary"
    ok "Playwright browser cache" "$HOME/.cache/ms-playwright"
else
    warn "Playwright browser cache" "missing or empty; run nix develop --command bin/playwright-install before browser tests"
end

check_port 54328 "PostgreSQL"
check_port 63798 "Redis"

echo ""
printf "Doctor complete: %s failure(s), %s warning(s).\n" "$fail_count" "$warn_count"

if test "$fail_count" -gt 0
    exit 1
end
