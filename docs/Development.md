# Table of contents

- Setting up the environment
  1. [Setting up development environment on Linux](#setting-up-development-environment-on-linux)
  2. [Setting up development environment on Windows 10](#setting-up-development-environment-on-windows-10)
  3. [Setting up development environment on Mac](#setting-up-development-environment-on-mac)
- [Running the development environment](#running-the-development-environment)

# Setting up the development environment

## Setting up development environment on Linux

### Development tools

#### DevOps

Following executables are used for managing the system. You may add the these to the `/usr/local/bin`. Or alternatively add them to a folder in the path.

1. [Skaffold](https://skaffold.dev/docs/install/)
2. [Kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
3. [Minikube](https://minikube.sigs.k8s.io/docs/start/)
4. [Kustomize](https://kubectl.docs.kubernetes.io/installation/kustomize/binaries/)

#### Dependencies

Install the following packages to your linux system:

1. [Docker](https://docs.docker.com/engine/install/)
2. [PostgreSQL](http://postgresguide.com/setup/install.html)
3. [Actionlint](https://github.com/rhysd/actionlint#quick-start)
4. [Node version manager (NVM)](https://github.com/nvm-sh/nvm#installing-and-updating)

You may also need:

1. [Stern](https://github.com/wercker/stern)
2. [Kubectx](https://github.com/ahmetb/kubectx)

In addition, you need the commands (`bc, find, jq, rsync, sponge`) for the scripts:

| Operation system | Install command                            |
| ---------------- | ------------------------------------------ |
| Ubuntu           | `sudo apt install bc find jq rsync sponge` |
| Arch Linux       | `pacman -Syu bc find jq rsync moretools`   |

#### Rust development tools

You don't need these if you don't intend to change the headless-lms.

1. Install [Rust](https://www.rust-lang.org/tools/install)
2. Install sqlx-cli (`cargo install sqlx-cli` or `cargo install sqlx-cli --no-default-features --features rustls,postgres` to install with minimal dependencies)
3. Install OpenSSL (`libssl-dev` on Ubuntu, `openssl-devel` on Fedora)
4. Install `pkg-config`

### Optional configuration

#### Moving docker data root to another drive with more space

> NOTE: If you are using Cubbli laptop provided by the Computer Science department, please ensure that you move docker data root to your home drive, otherwise you will most likely run out of space.

1. `sudo systemctl stop docker`
2. `sudo vim /etc/docker/daemon.json` -
   with content:
   {
   "data-root": "/home/username/docker"
   }
3. `mkdir /home/$USER/docker`
4. `sudo rsync -aP /var/lib/docker /home/$USER/docker` (optional)
5. `sudo mv /var/lib/docker /var/lib/docker.old`
6. `sudo systemctl start docker`
   - Ensure all works fine by running: `docker run --rm hello-world`
7. `sudo rm -rf /var/lib/docker.old` (cleanup)

## Setting up development environment on Windows 10

### DevOps

Install [chocolatey](https://docs.chocolatey.org/en-us/choco/setup) as your package-manager. Then install the following packages.

1. Kubectl: [Choco instructions](https://community.chocolatey.org/packages/kubernetes-cli)
   - Alternative: [Kubernetes](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
2. Minikube: [Choco instructions](https://community.chocolatey.org/packages/minikube)
   - Alternative: [Minikube](https://minikube.sigs.k8s.io/docs/start/)
3. Postgresql: [Choco instructions](https://community.chocolatey.org/packages/postgresql)
   - Alternative: [Postgresql](http://postgresguide.com/setup/install.html)
4. Kustomize: [Choco instructions](https://community.chocolatey.org/packages/kustomize)
5. Skaffold: [Choco instructions](https://community.chocolatey.org/packages/skaffold)
   You can install all of the above with the following command:

```shell
choco install kubernetes-cli minikube postgresql kustomize skaffold
```

You may also need [stern](https://community.chocolatey.org/packages/stern) and [kubectx](https://community.chocolatey.org/packages/kubectx) which you can install with choco:

```shell
choco install stern kubectx
```

### Rust development tools

You don't need these if you don't intend to change the headless-lms.

1. Install rust (https://www.rust-lang.org/tools/install)
2. Install sqlx-cli (`cargo install sqlx-cli` or `cargo install sqlx-cli --no-default-features --features rustls,postgres` to install with minimal dependencies)

### Configuration for windows

#### Windows Terminal & Cygwin

1. Install [Windows Terminal](https://www.microsoft.com/en-us/p/windows-terminal/9n0dx20hk701?activetab=pivot:overviewtab)
2. Install [Cygwin](https://www.cygwin.com/)
   - During installation of Cygwin you will be prompted for additional packages, these are needed: `postgres-client` & `procps-ng`
3. Open Windows Terminal and press the small arrow down and open Settings (as JSON), add the following:

```
profiles: {
  ...
  list: [
    ...
    {
      "guid": "{00000000-0000-0000-0000-000000000001}",
      "commandline": "C:/cygwin64/Cygwin.bat",
      "icon": "C:/cygwin64/Cygwin-Terminal.ico",
      "hidden": false,
      "name": "Cygwin"
    }
  ]
}
```

#### Install Cygwin on VSCode

1. Install Cgywin to your windows computer as described above
2. In order to install Cgywin on VSCode we need to install shell launcher extension
3. Install shell launcher from the extension market on VSCode
4. Read the installation guide to add keyboard shortcode to your VSCode keybindings.json file

```
[{
   "key": "ctrl+shift+t",
   "command": "shellLauncher.launch"
}]
```

5. Next go to settings on VSCode and search for shell launcher and click "Edit in settings",
6. Add the code below to the `shellLauncher.shells.windows` array

```
[{
   "shell": "C:\\cygwin64\\bin\\bash.exe",
   "args": ["--login"],
   "label": "Cygwin Bash",
   "launchName": "Cygwin Bash",
}]
```

7. To use Cygwin hold CTLR + SHIFT + T

#### Skaffold

1. Download [Skaffold](https://skaffold.dev/docs/install/) latest [stable release](https://storage.googleapis.com/skaffold/releases/latest/skaffold-windows-amd64.exe) for Windows and save it under `C:\Binary`.
2. Rename the executable to `skaffold.exe`.
3. Start `cmd` or `Powershell` as administrator and run: `rundll32.exe sysdm.cpl,EditEnvironmentVariables`
4. Under **System variables** click the **Path** row and click button `Edit...`, click button `New` and type in the row: `C:\Binary\`.
5. Check with `Git Bash` or `Cygwin` that Skaffold is in correct folder by running `which skaffold`.

## Setting up development environment on Mac

### Development tools

#### Brew

If you're using macOS, please install [homebrew](https://brew.sh/)

#### DevOps

Following executables are used for managing the system. You may add the these to the `/usr/local/bin`. Or alternatively add them to a folder in the path.

1. [Skaffold](https://skaffold.dev/docs/install/)
2. [Kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
3. [Minikube](https://minikube.sigs.k8s.io/docs/start/)
4. [Kustomize](https://kubectl.docs.kubernetes.io/installation/kustomize/binaries/)

You can install all of the above dependencies with homebrew:

```
brew install skaffold kubernetes-cli@1.22 minikube kustomize
```

#### Dependencies

Install the following packages to your macOS:

1. [Docker](https://docs.docker.com/engine/install/)
2. [PostgreSQL](http://postgresguide.com/setup/install.html)
3. [Actionlint](https://github.com/rhysd/actionlint#quick-start)
4. [Node version manager (NVM)](https://github.com/nvm-sh/nvm#installing-and-updating)

You may also need:

1. [Stern](https://github.com/wercker/stern)
2. [Kubectx](https://github.com/ahmetb/kubectx)

In addition, you need the commands (`bc, find, jq, rsync, sponge`) for the scripts:

```
brew install bc jq rsync sponge
```

You may also need stern and kubectx:

```
brew install kubectx stern
```

#### Rust development tools

You don't need these if you don't intend to change the headless-lms.

1. Install [Rust](https://www.rust-lang.org/tools/install)
2. Install sqlx-cli (`cargo install sqlx-cli` or `cargo install sqlx-cli --no-default-features --features rustls,postgres` to install with minimal dependencies)
3. Install OpenSSL (`brew install openssl@3`)
4. Install `pkg-config` (`brew install pkg-config`)

# Running the development environment

## Starting minikube

### Linux

Run the command `./bin/minikube-start` from the root directory

### Mac

Run the command `./bin/minikube-start` from the root directory

## Setting up local domain

### Linux

After skaffold has started up, we need to add a local domain name so that we can access the ingress of the cluster.

Copy the IP address for `project-331-ingress` from:

```sh
minikube ip
```

Next, add a hosts entry for the IP address you got from the previous command:

```
ip-from-previous-command	project-331.local
```

You can find the hosts file in Linux from `/etc/hosts`.

After that, you should be able to access the application by going to `http://project-331.local/` in your web browser.

Take a look at `kubernetes/ingress.yml` to see how requests are routed to different services.

### Windows

After skaffold has started up, we need to add a local domain name so that we can access the ingress of the cluster.

Copy the IP address for `project-331-ingress` from:

```sh
minikube ip
```

Next, add a hosts entry for the IP address you got from the previous command:

```
ip-from-previous-command	project-331.local
```

You can find the hosts file in Windows from `C:\Windows\System32\drivers\etc` (edit as administrator).
For example start `Powershell` in administrator mode, navigate to path above and write `notepad hosts`.

After that, you should be able to access the application by going to `http://project-331.local/` in your web browser. Take a look at `kubernetes/ingress.yml` to see how requests are routed to different services.

Take a look at `kubernetes/ingress.yml` to see how requests are routed to different services.

### Mac

After skaffold has started up, we need to add a local domain name so that we can access the ingress of the cluster.

Copy the IP address for `project-331-ingress` from:

```sh
minikube ip
```

Next, add a hosts entry for the IP address you got from the previous command:

```
ip-from-previous-command	project-331.local
```

You can find the hosts file in macOS from `/etc/hosts`.

After that, you should be able to access the application by going to `http://project-331.local/` in your web browser.

Take a look at `kubernetes/ingress.yml` to see how requests are routed to different services.

## Installing secret-projects dependencies

In the root directory, run the command `nvm use`. After that you should have node 16. Then run `npm ci` in the root folder to install the dependencies and `./bin/npm-ci-all` which will install all the dependencies for the services.

Once you've installed the node modules run the command `./bin/copy-and-check-shared-module` which will copy the contents of the shared module to each of the services.

Add the environment variables for the headless-lms by the following command

```shell
cp services/headless-lms/models/.env.example services/headless-lms/models/.env
```

## Starting development cluster

Before starting the cluster, make sure skaffold is running.

### Linux

In the root of the repo, run: `bin/dev`. This script will start the development cluster with skaffold. The initial build will take a while but after that is done, everything should be relatively quick.

### Windows

Start Windows Terminal (Make sure you are using _Cygwin_ terminal)

In the root of the repo, run: `bin/dev`. This script will start the development cluster with skaffold. The initial build will take a while but after that is done, everything should be relatively quick.

### Mac

In the root of the repo, run: `bin/dev`. This script will start the development cluster with skaffold. The initial build will take a while but after that is done, everything should be relatively quick.
