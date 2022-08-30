# Development

## Table of Contents

1. [Setting up development environment on Linux](#setting-up-development-environment-on-linux)
2. [Setting up development environment on Windows 10](#setting-up-development-environment-on-windows-10)

## Setting up development environment on Linux

### Development tools

1. Install Skaffold: https://skaffold.dev/docs/install/
2. Install Kubectl: https://kubernetes.io/docs/tasks/tools/install-kubectl/
3. Install Minikube: https://minikube.sigs.k8s.io/docs/start/
4. Install Kustomize: https://kubectl.docs.kubernetes.io/installation/kustomize/binaries/
   - mkdir ~/bin/
   - Add ~/bin/ to PATH
   - Run Kustomize installation script in the folder
5. Install Docker: https://docs.docker.com/engine/install/
6. Install Postgresql: http://postgresguide.com/setup/install.html

You may also need stern and kubectx.

### Special tools for headless-lms

You don't need these if you don't intend to change the headless-lms.

1. Install rust (https://www.rust-lang.org/tools/install)
2. Install sqlx-cli (`cargo install sqlx-cli` or `cargo install sqlx-cli --no-default-features --features rustls,postgres` to install with minimal dependencies)
3. Install OpenSSL (`libssl-dev` on Ubuntu, `openssl-devel` on Fedora)
4. Install `pkg-config`

### Setting up minikube

Start minikube:

```sh
bin/minikube-start
```

#### Moving docker data root to another drive with more space

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

> NOTE: If you are using Cubbli laptop provided by the Computer Science department, please ensure that you move docker data root to your home drive, otherwise you will most likely run out of space.

#### Using Node Version Manager

This project expects is configured for at least major node version 14. You can use Node Version Manager to manage multiple node versions on your system.

1. Run `command -v nvm`. If it prints `nvm`, you are already have it installed and can probably skip to step 4.
2. Remove existing installation of node with `sudo apt-get remove nodejs` if you have one.
3. [Install nvm](https://github.com/nvm-sh/nvm#installing-and-updating) and refresh your terminal.
4. `nvm install 14` to download the latest `14.x` version.
5. `nvm alias default 14` to set `14.x` version as the default version when running node commands.

### Starting the development cluster

In the root of the repo, run: `bin/dev`. This script will start the development cluster with skaffold. The initial build will take a while but after that is done, everything should be relatively quick.

You can monitor the process by running `bin/pods` in another terminal.

TIP: For multiple terminal windows, we recommend you to use a terminal with split window support for convenience. For Linux, one good option is [Tilix](https://gnunn1.github.io/tilix-web/).

### Setting up a local domain name

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

After that, you should be able to access the application by going to `http://project-331.local/` in your web browser. Take a look at `kubernetes/ingress.yml` to see how requests are routed to different services.

## Setting up development environment on Windows 10

### Development tools

Install the following tools with [chocolatey](https://docs.chocolatey.org/en-us/choco/setup):

1. Kubectl: [Choco instructions](https://community.chocolatey.org/packages/kubernetes-cli)
   - Alternative: [Kubernetes](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
2. Minikube: [Choco instructions](https://community.chocolatey.org/packages/minikube)
   - Alternative: [Minikube](https://minikube.sigs.k8s.io/docs/start/)
3. Postgresql: [Choco instructions](https://community.chocolatey.org/packages/postgresql)
   - Alternative: [Postgresql](http://postgresguide.com/setup/install.html)
4. Kustomize: [Choco instructions](https://community.chocolatey.org/packages/kustomize)

You may also need [stern](https://community.chocolatey.org/packages/stern) and [kubectx](https://community.chocolatey.org/packages/kubectx).

### Special tools for headless-lms

You don't need these if you don't intend to change the headless-lms.

1. Install rust (https://www.rust-lang.org/tools/install)
2. Install sqlx-cli (`cargo install sqlx-cli` or `cargo install sqlx-cli --no-default-features --features rustls,postgres` to install with minimal dependencies)

### Windows Terminal & Cygwin

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

### Install Cygwin on VSCode

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

### Skaffold

1. Download [Skaffold](https://skaffold.dev/docs/install/) latest [stable release](https://storage.googleapis.com/skaffold/releases/latest/skaffold-windows-amd64.exe) for Windows and save it under `C:\Binary`.
2. Rename the executable to `skaffold.exe`.
3. Start `cmd` or `Powershell` as administrator and run: `rundll32.exe sysdm.cpl,EditEnvironmentVariables`
4. Under **System variables** click the **Path** row and click button `Edit...`, click button `New` and type in the row: `C:\Binary\`.
5. Check with `Git Bash` or `Cygwin` that Skaffold is in correct folder by running `which skaffold`.

### Setting up minikube (Virtualbox)

Install [Virtualbox](https://www.virtualbox.org/).

> NOTE: You may need the `--no-vtx-check` parameter on some Windows version for `bin/start-minikube` command when using Virtualbox, please try to run the command without it first and see if it works.

Example:

```sh
bin/start-minikube (--no-vtx-check)
```

### Starting the development cluster

Start Windows Terminal (Make sure you are using _Cygwin_ terminal)

In the root of the repo, run: `bin/dev`. This script will start the development cluster with skaffold. The initial build will take a while but after that is done, everything should be relatively quick.

You can monitor the process by running `bin/pods` in another _Cygwin_ terminal.

### Setting up a local domain name

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
