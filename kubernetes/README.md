# Kubernetes

This folder contains the Kubernetes configurations for deployments. The configurations use Kustomize (https://kustomize.io/) with a base environment that contains common templates for Kubernetes resources, and overlays for development, staging and production.

The overlays build upon the base configuration by adding either more configuration or by adding patches to the base configuration: https://kubectl.docs.kubernetes.io/references/kustomize/patches/.

If you add a new Kubernetes config, remember to add it to one of the `kustomization.yaml` files — otherwise it will be ignored.

## Previewing

Development:

```bash
bin/kustomize-preview-dev
```

Staging:

```bash
bin/kustomize-preview-staging
```

Production:

```bash
bin/kustomize-preview-production
```

Test:
```bash
bin/kustomize-preview-test
```
