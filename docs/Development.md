# Development

## Table of Contents
1. [Setting up development environment on Linux](#setting-up-development-environment-on-linux)
2. [Setting up development environment on Windows 10](#setting-up-development-environment-on-windows-10)
## Setting up development environment on Linux

### Development tools

1. Install Skaffold: https://skaffold.dev/docs/install/ 
2. Install kubectl: https://kubernetes.io/docs/tasks/tools/install-kubectl/
3. Install minikube: https://minikube.sigs.k8s.io/docs/start/

You may also need stern and kubectx.

### Setting up minikube

Start minikube:

```sh
minikube start
```

Enable the ingress addon:

```
minikube addons enable ingress
```

### Starting the development cluster

In the root of the repo, run: `bin/dev`. This skript will start the development cluster with skaffold. The initial build will take a while but after that is done, everything should be relatively quick.

You can monitor the process by running `watch kubectl get pods` in another terminal.

TIP: For multiple terminal windows, we recommend you to use a terminal with split window support for convenience. For Linux, one good option is [Tilix](https://gnunn1.github.io/tilix-web/).

### Setting up a local domain name

After skaffold has started up, we need to add a local domain name so that we can access the ingress of the cluster.

List ingresses with kubectl and grab the IP address for `project-331-ingress`:

```sh
kubectl get ingress
```

Next, add a hosts entry for the IP address you got from the previous command:

```
ip-from-previous-command	project-331.local
```

You can find the hosts file in Linux from `/etc/hosts`.

After that, you should be able to access the application by going to `http://project-331.local/` in your web browser. Take a look at `kubernetes/ingress.yml` to see how requests are routed to different services.


## Setting up development environment on Windows 10 

### Development tools

Install the following tools with [chocolatey](https://docs.chocolatey.org/en-us/choco/setup ):  
1. Kubectl: https://kubernetes.io/docs/tasks/tools/install-kubectl/
2. Minikube: https://minikube.sigs.k8s.io/docs/start/

You may also need [stern](https://community.chocolatey.org/packages/stern) and [kubectx](https://community.chocolatey.org/packages/kubectx).

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

### Skaffold

1. Download [Skaffold](https://skaffold.dev/docs/install/) latest [stable release](https://storage.googleapis.com/skaffold/releases/latest/skaffold-windows-amd64.exe) for Windows and save it under `C:\Binary`.
2. Rename the executable to `skaffold.exe`.
3. Start `cmd` or `Powershell` as administrator and run: `rundll32.exe sysdm.cpl,EditEnvironmentVariables`
4. Under **System variables** click the **Path** row and click button `Edit...`, click button `New` and type in the row: `C:\Binary\`.
5. Check with `Git Bash` or `Cygwin` that Skaffold is in correct folder by running `which skaffold`.

### Setting up minikube (HyperV/Virtualbox)

Using Windows 10 Pro, you can enable HyperV with these [instructions](https://docs.microsoft.com/en-us/virtualization/hyper-v-on-windows/quick-start/enable-hyper-v).  

**NB!** If you don't have access to HyperV, you can install [Virtualbox](https://www.virtualbox.org/) and change driver to `--vm-driver=virtualbox` for Minikube commands.
> NOTE: You may need the `--no-vtx-check` parameter for `minikube start` when using Virtualbox, please try to run the command without it first and see if it works.

Example:

```sh
minikube start --vm-driver=hyperv
```

Enable ingress:
```
minikube addons enable ingress
```

### Starting the development cluster

Start Windows Terminal (Make sure you are using *Cygwin* terminal)

In the root of the repo, run: `bin/dev`. This skript will start the development cluster with skaffold. The initial build will take a while but after that is done, everything should be relatively quick.

You can monitor the process by running `watch kubectl get pods` in another *Cygwin* terminal.

### Setting up a local domain name

After skaffold has started up, we need to add a local domain name so that we can access the ingress of the cluster.

List ingresses with kubectl and grab the IP address for `project-331-ingress`:

```sh
kubectl get ingress
```

Next, add a hosts entry for the IP address you got from the previous command:

```
ip-from-previous-command	project-331.local
```

You can find the hosts file in Windows from `C:\Windows\System32\drivers\etc` (edit as administrator).

After that, you should be able to access the application by going to `http://project-331.local/` in your web browser. Take a look at `kubernetes/ingress.yml` to see how requests are routed to different services.
