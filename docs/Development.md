# Development Environment Setup

This document outlines the steps required to set up a development environment for Secret Project 331 on Linux, Windows, and macOS. Note that we use Linux for development at the University of Helsinki, so it may offer the best support and compatibility.

## Table of Contents

1. [Setting Up the Environment](#setting-up-the-environment)
   - [Linux Setup](#setting-up-on-linux)
   - [Windows Setup](#setting-up-on-windows)
   - [macOS Setup](#setting-up-on-macos)
2. [Running the Development Environment](#running-the-development-environment)

---

## Setting Up the Environment

### Setting Up on Linux

**Note**: After installing all required tools, run `bin/print-versions` to confirm that dependencies are correctly installed.

#### DevOps Tools

Install the following tools to manage the development environment:

1. [Skaffold](https://skaffold.dev/docs/install/)
2. [Kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
3. [Minikube](https://minikube.sigs.k8s.io/docs/start/)
4. [Kustomize](https://kubectl.docs.kubernetes.io/installation/kustomize/binaries/)

#### Additional Dependencies

Install these packages on your Linux system:

1. [Docker](https://docs.docker.com/engine/install/)
2. [PostgreSQL](http://postgresguide.com/setup/install.html)
3. [Actionlint](https://github.com/rhysd/actionlint#quick-start)
4. [Node Version Manager (NVM)](https://github.com/nvm-sh/nvm#installing-and-updating)

Optional utilities:

- [Stern](https://github.com/wercker/stern) for logs aggregation
- [Kubectx](https://github.com/ahmetb/kubectx) for easy Kubernetes context switching

Other essential commands required by scripts (`bc`, `find`, `jq`, `rsync`, `sponge`):

```bash
# Ubuntu
sudo apt install bc find jq rsync moreutils

# Arch Linux
sudo pacman -Syu bc find jq rsync moreutils
```

#### Rust Development Tools

1. Install [Rust](https://www.rust-lang.org/tools/install).
2. Install `sqlx-cli`:
   ```bash
   cargo install sqlx-cli --no-default-features --features rustls,postgres
   ```
3. Install OpenSSL (`libssl-dev` on Ubuntu, `openssl-devel` on Fedora).
4. Install `pkg-config` and `oxipng`:
   ```bash
   cargo install oxipng  # or sudo pacman -S oxipng on Arch
   ```

### Setting Up on Windows

**DevOps Tools**

1. Install [Chocolatey](https://docs.chocolatey.org/en-us/choco/setup).
2. Use Chocolatey to install the required packages:
   ```bash
   choco install kubernetes-cli minikube postgresql kustomize skaffold stern kubectx
   ```

#### Rust Development Tools

1. Install [Rust](https://www.rust-lang.org/tools/install).
2. Install `sqlx-cli` and `oxipng`:
   ```bash
   cargo install sqlx-cli --no-default-features --features rustls,postgres
   cargo install oxipng
   ```

#### Windows Terminal and Cygwin

1. Install [Windows Terminal](https://aka.ms/terminal).
2. Install [Cygwin](https://www.cygwin.com/), ensuring you include the `postgres-client` and `procps-ng` packages.
3. To add Cygwin as a profile in Windows Terminal, include the following in your Windows Terminal settings:

   ```json
   {
     "guid": "{00000000-0000-0000-0000-000000000001}",
     "commandline": "C:/cygwin64/Cygwin.bat",
     "icon": "C:/cygwin64/Cygwin-Terminal.ico",
     "hidden": false,
     "name": "Cygwin"
   }
   ```

#### Configuring VSCode to Use Cygwin

1. Install **Shell Launcher** in VSCode.
2. In your `settings.json`, add the following to use Cygwin as a terminal shell:

   ```json
   "shellLauncher.shells.windows": [
       {
           "shell": "C:\\cygwin64\\bin\\bash.exe",
           "args": ["--login"],
           "label": "Cygwin Bash"
       }
   ]
   ```

3. Use `Ctrl+Shift+T` in VSCode to launch a Cygwin terminal.

### Setting Up on macOS

#### Required Tools (via Homebrew)

Install [Homebrew](https://brew.sh/) if not already installed, then use it to install the required packages:

```bash
brew install skaffold kubernetes-cli@1.22 minikube kustomize docker postgresql actionlint
```

Additional utilities:

```bash
brew install bc jq rsync sponge coreutils kubectx stern
```

#### Rust Development Tools

1. Install [Rust](https://www.rust-lang.org/tools/install).
2. Install `sqlx-cli`:
   ```bash
   cargo install sqlx-cli --no-default-features --features rustls,postgres
   ```
3. Install OpenSSL, `pkg-config`, and `oxipng`:
   ```bash
   brew install openssl@3 pkg-config
   cargo install oxipng
   ```

---

## Running the Development Environment

### Installing Project Dependencies

In the root directory, install the project dependencies:

```bash
nvm install
nvm use
npm ci
bin/npm-ci-all
```

Make sure `TMC-Langs` is downloaded:

```bash
bin/download-tmc-langs
```

Next, copy the shared module contents:

```bash
bin/copy-and-check-shared-module
```

### Configuring Environment Variables

Set up the environment variables for `headless-lms`:

```bash
cp services/headless-lms/models/.env.example services/headless-lms/models/.env
```

### Starting Minikube

Before running Minikube, check for any setup issues:

```bash
bin/detect-dev-env-problems
```

To start Minikube, use:

```bash
bin/minikube-start
```

### Setting Up a Local Domain

#### Linux

Retrieve the Minikube IP address:

```bash
minikube ip
```

Add this IP to your `/etc/hosts` file:

```plaintext
<minikube-ip>    project-331.local
```

#### Windows

Use the Minikube IP obtained from `minikube ip` and add a hosts entry:

```plaintext
<minikube-ip>    project-331.local
```

Hosts file location: `C:\Windows\System32\drivers\etc\hosts`

#### macOS

Similar to Linux, use `minikube ip` to retrieve the IP, then add it to `/etc/hosts`.

### Starting the Application

Ensure Minikube is running, then:

#### Linux

In the root of the repository:

```bash
bin/dev
```

#### Windows

Use **Cygwin** in Windows Terminal, navigate to the root of the repository:

```bash
bin/dev
```

#### macOS

In the root of the repository:

```bash
bin/dev
```

### Recommended Terminal Tools for Multi-Window Management

For efficient workflow, use a terminal with split-window support. Recommended options:

- **Linux**: [Tilix](https://gnunn1.github.io/tilix-web/)
- **Windows**: [Windows Terminal](https://aka.ms/terminal)
- **macOS**: [iTerm2](https://iterm2.com/)

Verify your setup with:

```bash
bin/detect-dev-env-problems
```
