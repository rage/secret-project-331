# Development

## Setting up development environment with Skaffold

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

TIP: For multiple terminal windows, we recommend you to use a terminal with split window support for convenience. For Linux, one good option is [Tilix](https://gnunn1.github.io/tilix-web/) and if you're using Windows, you can use the new [Windows terminal](https://github.com/microsoft/terminal) (Documentation here: https://docs.microsoft.com/en-us/windows/terminal/panes).


### Setting up a local domain name

After skaffold has started up, we need to add a local domain name so that we can access the ingress of the cluster.

List ingresses with kubectl and grab the IP address for `project-331-ingress`:

```sh
kubectl get ingress
```

Next, add a entry for the IP address you got from the previous command:

```
ip-from-previous-command	project-331.local
```

After that, you should be able to access the application by going to `http://project-331.local/` in your web browser. Take a look at `kubernetes/ingress.yml` to see how requests are routed to different services.
