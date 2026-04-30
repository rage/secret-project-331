config.define_string("mode", usage="Required. One of: dev, test.")
config.define_string_list("resources", args=True, usage="Optional Tilt resources to run.")

cfg = config.parse()
mode = cfg.get("mode", "")
requested_resources = cfg.get("resources", [])

if mode not in ["dev", "test"]:
    fail("Tiltfile requires --mode dev or --mode test.")

config.set_enabled_resources(requested_resources)

kind_context = os.environ.get("TILT_KIND_CONTEXT", "kind-kind")
if not kind_context.startswith("kind-"):
    fail("This local Tilt experiment must run against Kind. Use --context kind-kind or another kind-* context.")

allow_k8s_contexts(kind_context)
update_settings(max_parallel_updates=6)

WAIT_FOR_INGRESS = "wait-for-ingress"
SUPPORT_RESOURCE = "support"
INGRESS_NGINX_DEPLOY_URL = "https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.15.1/deploy/static/provider/kind/deploy.yaml"
PROJECT_DOMAIN = "project-331.local"
NODE_SERVICES = [
    "cms",
    "main-frontend",
    "example-exercise",
    "quizzes",
    "tmc",
]

NODE_DOCKER_IGNORE = [
    ".env",
    ".next",
    ".turbo",
    ".vscode",
    "coverage",
    "node_modules",
    "playwright-report",
    "test-results",
    "tsconfig.tsbuildinfo",
]

HEADLESS_LMS_DOCKER_IGNORE = [
    ".env",
    "dbdoc",
    "models/.env",
    "requests.rest",
    "server/generated-docs",
    "target",
    "**/target",
    "uploads",
]

NODE_REBUILD_FILES = [
    "Dockerfile",
    "next.config.js",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
]

HEADLESS_LMS_REBUILD_FILES = [
    "Cargo.lock",
    "Cargo.toml",
    "Dockerfile",
    "base/Cargo.toml",
    "certificates/Cargo.toml",
    "chatbot/Cargo.toml",
    "doc-macro/Cargo.toml",
    "entrypoint/Cargo.toml",
    "langs-api/Cargo.toml",
    "models/Cargo.toml",
    "server/Cargo.toml",
    "utils/Cargo.toml",
]

NODE_REBUILD_DEPS = ["services/%s/%s" % (service, path) for service in NODE_SERVICES for path in NODE_REBUILD_FILES]
HEADLESS_LMS_REBUILD_DEPS = ["services/headless-lms/%s" % path for path in HEADLESS_LMS_REBUILD_FILES]

WARM_ROUTE_DEPS = (
    ["bin/warm-routes"] +
    ["services/%s/src" % service for service in NODE_SERVICES] +
    NODE_REBUILD_DEPS +
    HEADLESS_LMS_REBUILD_DEPS +
    [
        "services/headless-lms/models/src",
        "services/headless-lms/server/src",
    ]
)


def kubectl(args):
    return "kubectl --context=%s %s" % (kind_context, args)


KIND_NODE_IP_CMD = kubectl("get nodes -o jsonpath='{.items[0].status.addresses[?(@.type==\"InternalIP\")].address}'")

WAIT_FOR_INGRESS_CMD = (
    "set -e; " +
    "if ! " + kubectl("-n ingress-nginx get deployment ingress-nginx-controller >/dev/null 2>&1") + "; then " +
    "echo 'Installing ingress-nginx for Kind.'; " +
    kubectl("apply -f %s" % INGRESS_NGINX_DEPLOY_URL) + "; " +
    "fi; " +
    "echo 'Configuring ingress-nginx to allow this project ingress annotations.'; " +
    kubectl("-n ingress-nginx patch configmap ingress-nginx-controller --type merge -p '{\"data\":{\"allow-snippet-annotations\":\"true\",\"annotations-risk-level\":\"Critical\"}}'") + "; " +
    "echo 'Waiting for the ingress to be ready.' && " +
    "echo '> kubectl --context=%s wait --namespace ingress-nginx --for=condition=available deployment/ingress-nginx-controller' && " +
    kubectl("wait --namespace ingress-nginx --for=condition=available deployment/ingress-nginx-controller --timeout=120s") + "; " +
    "KIND_NODE_IP=$(" + KIND_NODE_IP_CMD + "); " +
    "echo \"Kind ingress is reachable at http://" + PROJECT_DOMAIN + "/ when /etc/hosts contains: $KIND_NODE_IP " + PROJECT_DOMAIN + "\"; " +
    "echo 'Removing ingress-nginx admission webhook for local Kind development.'; " +
    kubectl("delete validatingwebhookconfiguration ingress-nginx-admission --ignore-not-found")
) % kind_context

local_resource(
    WAIT_FOR_INGRESS,
    cmd=WAIT_FOR_INGRESS_CMD,
    trigger_mode=TRIGGER_MODE_AUTO,
    labels=["bootstrap"],
)

WEB_WORKLOADS = [
    "headless-lms",
    "cms",
    "main-frontend",
    "example-exercise",
    "quizzes",
    "tmc",
]

OTHER_HEADLESS_LMS_WORKLOADS = [
    "chatbot-syncer",
    "email-deliver",
    "mailchimp-syncer",
    "regrader",
    "service-info-fetcher",
    "calculate-page-visit-stats",
    "ended-exams-processor",
    "open-university-registration-link-fetcher",
    "peer-review-updater",
    "sync-tmc-users",
    "headless-lms-run-migrations",
]

BASE_SUPPORT_OBJECTS = [
    "headless-lms-inspector:serviceaccount",
    "tmc-account:serviceaccount",
    "headless-lms-readonly:role",
    "tmc-role:role",
    "headless-lms-readonly-binding:rolebinding",
    "tmc-role:rolebinding",
    "postgres-pv:persistentvolume",
    "redis-pv:persistentvolume",
    "postgres-pvc:persistentvolumeclaim",
    "redis-pvc:persistentvolumeclaim",
    "postgres-configuration:configmap",
    "redis-configuration:configmap",
    "headless-lms-secrets:secret",
    "postgres-credentials:secret",
    "access-ingress-internally:service:ingress-nginx",
    "project-331-ingress:ingress",
    "project-331-other-domains:ingress",
]

DEV_SUPPORT_OBJECTS = [
    "persistent-file-storage-pv:persistentvolume",
    "persistent-file-storage-pvc:persistentvolumeclaim",
]

TEST_SUPPORT_OBJECTS = [
    "headless-lms-pdb:poddisruptionbudget",
]


def configure_support_resource(objects):
    k8s_resource(
        objects=objects,
        new_name=SUPPORT_RESOURCE,
        resource_deps=[WAIT_FOR_INGRESS],
        pod_readiness="ignore",
        labels=["support"],
    )


def configure_k8s_resources():
    for workload in WEB_WORKLOADS:
        k8s_resource(workload=workload, resource_deps=[SUPPORT_RESOURCE], labels=["web"])

    for workload in OTHER_HEADLESS_LMS_WORKLOADS:
        k8s_resource(workload=workload, resource_deps=[SUPPORT_RESOURCE], labels=["worker"])

    k8s_resource(
        workload="postgres",
        port_forwards="54328:5432",
        resource_deps=[SUPPORT_RESOURCE],
        labels=["data"],
    )
    k8s_resource(
        workload="redis",
        port_forwards="63798:6379",
        resource_deps=[SUPPORT_RESOURCE],
        labels=["data"],
    )


def node_rebuild_deps(service):
    return ["services/%s/%s" % (service, path) for path in NODE_REBUILD_FILES]


def node_live_update(service):
    return [fall_back_on(path) for path in node_rebuild_deps(service)] + [
        sync("services/%s/src" % service, "/app/src"),
    ]


def headless_lms_sync(path):
    return sync("services/headless-lms/%s" % path, "/app/%s" % path)


def docker_ignore_for_service(service):
    if service == "headless-lms":
        return HEADLESS_LMS_DOCKER_IGNORE
    return NODE_DOCKER_IGNORE


TEST_IMAGES = [
    ("eu.gcr.io/moocfi-public/secret-project-headless-lms-production-slim:latest", "headless-lms", "Dockerfile.production.slim.dockerfile"),
    ("eu.gcr.io/moocfi-public/secret-project-cms-production-slim:latest", "cms", "Dockerfile.production.slim.dockerfile"),
    ("eu.gcr.io/moocfi-public/secret-project-main-frontend-production-slim:latest", "main-frontend", "Dockerfile.production.slim.dockerfile"),
    ("eu.gcr.io/moocfi-public/secret-project-example-exercise-production-slim:latest", "example-exercise", "Dockerfile.production.slim.dockerfile"),
    ("eu.gcr.io/moocfi-public/secret-project-quizzes-production-slim:latest", "quizzes", "Dockerfile.production.slim.dockerfile"),
    ("eu.gcr.io/moocfi-public/secret-project-tmc-production-slim:latest", "tmc", "Dockerfile.production.slim.dockerfile"),
]


def build_image(image, service, dockerfile, live_update_steps):
    docker_build(
        image,
        "services/%s" % service,
        dockerfile="services/%s/%s" % (service, dockerfile),
        ignore=docker_ignore_for_service(service),
        live_update=live_update_steps,
    )


if mode == "dev":
    k8s_yaml(kustomize("kubernetes/dev"))
    configure_support_resource(BASE_SUPPORT_OBJECTS + DEV_SUPPORT_OBJECTS)

    headless_lms_live_update = [fall_back_on(path) for path in HEADLESS_LMS_REBUILD_DEPS] + [
        headless_lms_sync("base/src"),
        headless_lms_sync("certificates/src"),
        headless_lms_sync("chatbot/src"),
        headless_lms_sync("doc-macro/src"),
        headless_lms_sync("entrypoint/src"),
        headless_lms_sync("langs-api/src"),
        headless_lms_sync("models/src"),
        headless_lms_sync("server/src"),
        headless_lms_sync("server/tests"),
        headless_lms_sync("utils/src"),
        headless_lms_sync("migrations"),
        headless_lms_sync("shared-module"),
    ]

    dev_images = [
        ("headless-lms", "headless-lms", "Dockerfile", headless_lms_live_update),
    ] + [(service, service, "Dockerfile", node_live_update(service)) for service in NODE_SERVICES]

    for image, service, dockerfile, live_update_steps in dev_images:
        build_image(image, service, dockerfile, live_update_steps)

    configure_k8s_resources()

    # resource_deps only orders the startup run; deps make warm-routes rerun on relevant source changes.
    local_resource(
        "warm-routes",
        cmd="bin/warm-routes || true",
        deps=WARM_ROUTE_DEPS,
        resource_deps=WEB_WORKLOADS,
        trigger_mode=TRIGGER_MODE_AUTO,
        labels=["warmup"],
    )

if mode == "test":
    trigger_mode(TRIGGER_MODE_MANUAL)
    k8s_yaml(kustomize("kubernetes/test"))
    configure_support_resource(BASE_SUPPORT_OBJECTS + TEST_SUPPORT_OBJECTS)

    for image, service, dockerfile in TEST_IMAGES:
        build_image(image, service, dockerfile, [])

    configure_k8s_resources()
