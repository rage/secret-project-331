# Development Environment Setup

> [!NOTE]
> Linux is the primary development platform at the MOOC center. macOS should also work but it's less tested.

## Requirements

- 200 GB free disk space
- Docker installed and your user in the `docker` group

## 1. Install tools

### Option A: Nix (recommended)

Run the Nix installer, then allow direnv to load the project shell:

```bash
bin/install-nix
direnv allow
```

This provides Rust, Node, pnpm, kubectl, Skaffold, Minikube, Kustomize, SQLx CLI, PostgreSQL client, and all other required tools automatically.

Alternatively, enter the shell manually with `nix develop`.

Verify the result:

```bash
bin/print-versions
```

<details>
<summary>Option B: Manual install (without Nix)</summary>

Note: After installing all tools manually, run `bin/print-versions` to confirm everything is in place.

### Linux

**DevOps tools**

Install [Skaffold](https://skaffold.dev/docs/install/), [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/), [Minikube](https://minikube.sigs.k8s.io/docs/start/), and [Kustomize](https://kubectl.docs.kubernetes.io/installation/kustomize/binaries/).

**System packages**

```bash
# Ubuntu
sudo apt install docker.io bc findutils jq rsync moreutils

# Arch Linux
sudo pacman -Syu docker bc find jq rsync moreutils
```

Add your user to the docker group: `sudo usermod -aG docker $USER`

**Node and pnpm**

Install [pnpm](https://pnpm.io/installation). pnpm manages the Node version automatically.

**Rust tools**

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install sqlx-cli and oxipng
cargo install sqlx-cli --no-default-features --features rustls,postgres
cargo install oxipng

# Install OpenSSL dev headers (Ubuntu)
sudo apt install libssl-dev pkg-config
```

Optional: [Stern](https://github.com/stern/stern), [Kubectx/Kubens](https://github.com/ahmetb/kubectx), [Actionlint](https://github.com/rhysd/actionlint)

### macOS

Install [Homebrew](https://brew.sh/) if not already installed, then:

```bash
brew install skaffold kubernetes-cli minikube kustomize docker postgresql actionlint
brew install bc jq rsync coreutils kubectx stern
```

Install [pnpm](https://pnpm.io/installation). pnpm manages the Node version automatically.

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
brew install openssl@3 pkg-config
cargo install sqlx-cli --no-default-features --features rustls,postgres
cargo install oxipng
```

### Windows

1. Install [Chocolatey](https://docs.chocolatey.org/en-us/choco/setup).
2. Install required tools:

```bash
choco install kubernetes-cli minikube postgresql kustomize skaffold stern kubectx
```

3. Install [pnpm](https://pnpm.io/installation). pnpm manages the Node version automatically.

4. Install [Rust](https://www.rust-lang.org/tools/install), then:

```bash
cargo install sqlx-cli --no-default-features --features rustls,postgres
cargo install oxipng
```

5. Install [Windows Terminal](https://aka.ms/terminal) and [Cygwin](https://www.cygwin.com/) (include `postgres-client` and `procps-ng` packages).

To add Cygwin as a profile in Windows Terminal, add this to your Windows Terminal settings:

```json
{
  "guid": "{00000000-0000-0000-0000-000000000001}",
  "commandline": "C:/cygwin64/Cygwin.bat",
  "icon": "C:/cygwin64/Cygwin-Terminal.ico",
  "hidden": false,
  "name": "Cygwin"
}
```

To use Cygwin as a terminal shell in VSCode, install **Shell Launcher** and add to `settings.json`:

```json
"shellLauncher.shells.windows": [
  {
    "shell": "C:\\cygwin64\\bin\\bash.exe",
    "args": ["--login"],
    "label": "Cygwin Bash"
  }
]
```

</details>

## 2. Project setup

From the repository root:

```bash
pnpm install
bin/pnpm-install-all
bin/tmc-langs-setup
bin/copy-and-check-shared-module
cp services/headless-lms/models/.env.example services/headless-lms/models/.env
```

## 3. Check for environment problems

```bash
bin/detect-dev-env-problems
```

Fix any reported issues before continuing.

## 4. Start Minikube

```bash
bin/minikube-start
```

## 5. Set up local domain

Add the Minikube IP to `/etc/hosts`:

```bash
echo "$(minikube ip)    project-331.local" | sudo tee -a /etc/hosts
```

<details>
<summary>macOS</summary>

Same as Linux: use `minikube ip` and add the result to `/etc/hosts`.

</details>

<details>
<summary>Windows</summary>

Get the IP with `minikube ip`, then add it to `C:\Windows\System32\drivers\etc\hosts`:

```text
<minikube-ip>    project-331.local
```

</details>

## 6. Start the development environment

From the repository root:

```bash
bin/dev
```

## 7. Seed the database

In a second terminal:

```bash
bin/seed
```

> [!NOTE]
> The first seed run compiles Rust code inside the pod and can take several minutes.

## Logging in

Default accounts are defined in `services/headless-lms/server/src/programs/seed`.

## Editor setup

To open the project in VS Code with recommended settings and extensions:

```bash
bin/code
```

Install the recommended extensions when prompted. They enable automatic code style checks and fixes on save.

## Troubleshooting

Run `bin/detect-dev-env-problems` to check the setup.

If the postgres pod does not become ready (check with `bin/pods`), run:

```bash
bin/postgres-remove-data
```

Then restart Minikube and re-run `bin/dev`.

## Developer resources

See the [docs index](https://github.com/rage/secret-project-331/tree/master/docs#readme).
