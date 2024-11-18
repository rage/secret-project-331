# Deployments

This project is designed to run on Kubernetes, ensuring a consistent and reliable setup across all environments. For local development, we use **Minikube** and **Skaffold** to start a Kubernetes cluster locally and deploy all project services in a production-like manner.

> [!TIP]
>
> ## TL;DR
>
> - **Automated Production Deployment**: Fully automated with GitHub Actions, Skaffold, and Minikube.
> - **Production Environment**: Deployed to Google Cloud Platform (GCP) Kubernetes.
> - **Local Testing**: Use `bin/test` to replicate the production environment locally.
> - **Run System Tests**: Use `bin/system-tests-run-tests` for end-to-end testing. This validates that the system as a whole functions correctly before deployment.

## Production Deployment Workflow

Our CI/CD pipeline ensures efficient and reliable deployments through three main stages:

### 1. Build

- Multi-stage builds are used to create:
  - **Cache Images**: Captures dependencies to speed up future builds.
  - **Slim Images**: Deployment-ready images with only essential components.
- Docker images and build outputs are saved for reuse during testing and deployment.

### 2. Test

- Images are deployed to a Minikube Kubernetes cluster using Skaffold.
- System tests, via `bin/system-tests-run-tests`, validate application behavior.
- Additional unit and integration tests are executed in the pipeline.
- Deployment is blocked if any test fails.

### 3. Deploy

- If all tests pass on the `master` branch:
  - Docker images are pushed to a cloud container registry.
  - Skaffold runs database migrations.
  - Validated images are deployed to the GCP Kubernetes cluster using Skaffold and Kustomize.

This workflow ensures every change is tested in a production-like environment before reaching live users.

## Kustomize for Environment Management

We use **Kustomize** to manage and customize Kubernetes manifests across environments. A shared base configuration defines most settings, while overlays adjust environment-specific configurations. This ensures consistency while keeping configurations modular.

| Environment     | Inherits From | Key Differences                                                                                     |
| --------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| **Base**        | None          | Contains most configurations; other environments override specifics as needed.                      |
| **Development** | Base          | Used in `bin/dev`; services run in development mode.                                                |
| **Production**  | Base          | Used for live deployments; services run in production mode.                                         |
| **Test**        | Production    | Used in `bin/test`; mirrors production but uses local resources like databases for testing locally. |

## Skaffold and Its Integration with Kustomize

**Skaffold** orchestrates the development and deployment workflows for Kubernetes. It is configured to use **Kustomize**, which provides environment-specific Kubernetes manifests.

### How They Work Together:

1. **Kustomize** defines the manifests:
   - The base configuration contains shared resources.
   - Overlays customize configurations for environments like development, production, and testing.
2. **Skaffold** manages the deployment pipeline:
   - For development, Skaffold uses the Kustomize overlay for the `development` environment to deploy locally.
   - For production, Skaffold applies the `production` overlay to deploy live services on GCP Kubernetes.

For example:

- **Local Development**: Skaffold applies `kubernetes/dev/kustomization.yaml` to deploy services on Minikube.
- **Production Deployment**: Skaffold applies `kubernetes/production/kustomization.yaml` to deploy services to GCP Kubernetes.

## Ingress Configuration

We use **Ingress** in Kubernetes to handle HTTP routing between multiple services deployed in the same cluster. Powered by the **Ingress-NGINX** controller, it routes HTTP requests based on paths, allowing all services to share a single domain.

Examples of routing:

- `/api` → **headless-lms**
- `/cms` → **cms**
- `/quizzes` → **quizzes**

Routing rules are defined in `kubernetes/base/ingress.yml`. For more details, refer to the [Ingress Documentation](https://kubernetes.io/docs/concepts/services-networking/ingress/) or the [Ingress-NGINX Documentation](https://kubernetes.github.io/ingress-nginx/).

## Local and Production Environments

| Feature                       | `bin/dev` (Development Mode)                 | `bin/test` (Local Prod Mode)                   | Production Deployment       |
| ----------------------------- | -------------------------------------------- | ---------------------------------------------- | --------------------------- |
| **Environment Variables**     | Development                                  | Development, but production settings turned on | Production-secured values   |
| **Database**                  | Local DB with seed data (`headless_lms_dev`) | Local DB with seed data (`headless_lms_test`)  | Live production DB          |
| **Build Process**             | Compiled in development mode                 | Compiled in production mode                    | Compiled in production mode |
| **Deployment Tool**           | Skaffold                                     | Skaffold                                       | Skaffold                    |
| **Kubernetes Cluster**        | Minikube                                     | Minikube                                       | GCP Kubernetes              |
| **Domain**                    | `project-331.local`                          | `project-331.local`                            | `courses.mooc.fi`           |
| **Deployments Configuration** | `skaffold.yml`                               | `skaffold.production.yml`                      | `skaffold.production.yml`   |

**`bin/dev`** is optimized for rapid iteration with live reloading. **`bin/test`** closely mirrors production, enabling a production-like system to be tested on any machine. The production deployment process is similar to `bin/test`, but it uses live infrastructure.

## Useful Links

- [Skaffold Documentation](https://skaffold.dev/docs/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kustomize Documentation](https://kustomize.io/)
- [Ingress-NGINX Documentation](https://kubernetes.github.io/ingress-nginx/)
- [Google Cloud Kubernetes Engine](https://cloud.google.com/kubernetes-engine)
