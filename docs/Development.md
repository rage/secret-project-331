# Development

## Setting up development environment with Skaffold

### Development tools

1. Install Skaffold: https://skaffold.dev/docs/install/
2. Install kubectl: https://kubernetes.io/docs/tasks/tools/install-kubectl/
3. Install minikube: https://minikube.sigs.k8s.io/docs/start/

You may also need stern and kubectx or [kubectxwin](https://github.com/thomasliddledba/kubectxwin).

Windows TIP: Install tools via Chocolatey.  
> **Alternative**: Save all `.exe` files in same location and rename them to be `skaffold.exe` etc.  
> Run command ```rundll32.exe sysdm.cpl,EditEnvironmentVariables``` and add the path for executable files to **System variable PATH**.

### Setting up minikube (Linux)

Start minikube:

```sh
minikube start
```

Enable the ingress addon:

```
minikube addons enable ingress
```

### Setting up minikube (Windows)

Using Windows 10 Pro, you can enable HyperV with these [instructions](https://docs.microsoft.com/en-us/virtualization/hyper-v-on-windows/quick-start/enable-hyper-v).  
If you don't have Windows 10 Pro, you can install [Docker Desktop for Windows](https://docs.docker.com/docker-for-windows/install/) and change driver to ```--vm-driver docker``` for Minikube commands.

*TODO: Figure out if you need to create the default vSwitch in HyperV or does Minikube take care of that*

Using HyperV:

```sh
minikube start --vm-driver hyperv
```

Enable ingress:
```
minikube addons enable ingress
```

### Starting the development cluster

In the root of the repo, run: `bin/dev`. This skript will start the development cluster with skaffold. The initial build will take a while but after that is done, everything should be relatively quick.

You can monitor the process by running `watch kubectl get pods` in another terminal.

TIP: For multiple terminal windows, we recommend you to use a terminal with split window support for convenience. For Linux, one good option is [Tilix](https://gnunn1.github.io/tilix-web/) and if you're using Windows, you can use the new [Windows terminal](https://github.com/microsoft/terminal) (Documentation here: https://docs.microsoft.com/en-us/windows/terminal/panes).


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
You can find the hosts file in Windows from `C:\Windows\System32\drivers\etc`.

After that, you should be able to access the application by going to `http://project-331.local/` in your web browser. Take a look at `kubernetes/ingress.yml` to see how requests are routed to different services.
