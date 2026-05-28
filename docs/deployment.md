# Deployment

The project runs on Kubernetes in all environments. Locally it uses Minikube + Skaffold. Production runs on GCP Kubernetes, deployed automatically from the `master` branch via GitHub Actions.

## CI/CD pipeline

On every push, GitHub Actions runs three stages:

1. **Build** - Builds Docker images using multi-stage builds (cache image for dependencies, slim image for production).
2. **Test** - Deploys images to a Minikube cluster with Skaffold, runs system tests and unit tests. Blocks deploy on failure.
3. **Deploy** - On `master` only: pushes images to the container registry, runs database migrations, deploys to GCP Kubernetes.

## Local environments

|                 | `bin/dev`           | `bin/test`                 | Production                 |
| --------------- | ------------------- | -------------------------- | -------------------------- |
| Build           | Development mode    | Production mode            | Production mode            |
| Database        | `headless_lms_dev`  | `headless_lms_test`        | Cloud SQL                  |
| Cluster         | Minikube            | Minikube                   | GCP Kubernetes             |
| Domain          | `project-331.local` | `project-331.local`        | `courses.mooc.fi`          |
| Skaffold config | `skaffold.yaml`     | `skaffold.production.yaml` | `skaffold.production.yaml` |

`bin/dev` uses live reload for fast iteration. `bin/test` builds production images and mirrors the CI environment — use it to reproduce CI failures locally.

## Kustomize overlays

Kubernetes manifests are managed with Kustomize. A shared base defines most resources; environment overlays override what differs.

- `kubernetes/base` - shared configuration
- `kubernetes/dev` - development overlay (`bin/dev`)
- `kubernetes/test` - test overlay (`bin/test`)
- `kubernetes/production` - production overlay

## Ingress

All services share the domain through ingress-nginx. Routing is path-based, defined in `kubernetes/base/ingress.yml`:

- `/api` - headless-lms
- `/cms` - cms
- `/quizzes` - quizzes
- `/` - main-frontend

## Links

- [Skaffold docs](https://skaffold.dev/docs/)
- [Kustomize docs](https://kustomize.io/)
- [Ingress-NGINX docs](https://kubernetes.github.io/ingress-nginx/)
