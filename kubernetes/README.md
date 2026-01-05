# Kubernetes

This folder contains the Kubernetes configurations for deployments. The configurations use Kustomize (https://kustomize.io/) with a base environment that contains common templates for Kubernetes resources, and overlays for development, staging and production.

The overlays build upon the base configuration by adding either more configuration or by adding patches to the base configuration: https://kubectl.docs.kubernetes.io/references/kustomize/patches/.

If you add a new Kubernetes config, remember to add it to one of the `kustomization.yaml` files — otherwise it will be ignored.

## Custom Labels

The Kubernetes configurations use custom labels to organize and target resources for patches:

### `deploymentType`

Used to categorize deployments based on their initialization requirements:

- `without-init-container`: Deployments that don't require init containers (e.g., frontend services like `cms`, `main-frontend`, `quizzes`, `tmc`, `course-material`, `example-exercise`)
- `with-init-container`: Deployments that require init containers, typically for database migrations or setup (e.g., `headless-lms`, `chatbot-syncer`, `email-deliver`, `regrader`)
- `with-init-container-cronjob`: CronJobs that require init containers (e.g., `ended-exams-processor`, `calculate-page-visit-stats`, `sync-tmc-users`)

These labels are used in overlay patches to apply different resource configurations (e.g., removing CPU/memory limits in development).

### `has-probes`

Indicates deployments that have health probes (`livenessProbe` and `readinessProbe`) configured. Set to `"true"` for deployments that expose HTTP health check endpoints.

This label is used in the development overlay to selectively disable liveness and readiness probes (while keeping startup probes) to reduce log spam during development.

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
