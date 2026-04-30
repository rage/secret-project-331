load("ext://uibutton", "cmd_button", "location")

config.define_string("mode", usage="Required. One of: dev, test, only-db.")
config.define_string_list(
    "resources", args=True, usage="Optional Tilt resources to run."
)

cfg = config.parse()
mode = cfg.get("mode", "")
requested_resources = cfg.get("resources", [])

if mode not in ["dev", "test", "only-db"]:
    fail("Tiltfile requires --mode dev, --mode test, or --mode only-db.")

config.set_enabled_resources(requested_resources)

kind_context = os.environ.get("TILT_KIND_CONTEXT", "kind-kind")
if not kind_context.startswith("kind-"):
    fail(
        "This local Tilt experiment must run against Kind. Use --context kind-kind or another kind-* context."
    )

allow_k8s_contexts(kind_context)
update_settings(max_parallel_updates=6)

MODE_RESOURCE = "mode-controls"
WAIT_FOR_INGRESS = "wait-for-ingress"
SUPPORT_RESOURCE = "support"
DATA_INFRA_RESOURCE = "data-infra"
SETUP_LABEL = "infra"
INGRESS_NGINX_DEPLOY_URL = "https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.15.1/deploy/static/provider/kind/deploy.yaml"
PROJECT_DOMAIN = "project-331.local"

NODE_SERVICES = [
    "cms",
    "main-frontend",
    "example-exercise",
    "quizzes",
    "tmc",
]

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

COMMON_TRIGGER_RESOURCES = (
    WEB_WORKLOADS + OTHER_HEADLESS_LMS_WORKLOADS + ["postgres", "redis"]
)

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

NODE_REBUILD_DEPS = [
    "services/%s/%s" % (service, path)
    for service in NODE_SERVICES
    for path in NODE_REBUILD_FILES
]
HEADLESS_LMS_REBUILD_DEPS = [
    "services/headless-lms/%s" % path for path in HEADLESS_LMS_REBUILD_FILES
]

WARM_ROUTE_DEPS = (
    ["bin/warm-routes"]
    + ["services/%s/src" % service for service in NODE_SERVICES]
    + NODE_REBUILD_DEPS
    + HEADLESS_LMS_REBUILD_DEPS
    + [
        "services/headless-lms/models/src",
        "services/headless-lms/server/src",
    ]
)


def shell_join(argv):
    return " ".join([shlex.quote(x) for x in argv])


def requested_resources_for_mode(target_mode):
    filtered_resources = []
    for resource in requested_resources:
        if target_mode == "test" and resource == "warm-routes":
            continue
        filtered_resources.append(resource)
    return filtered_resources


def trigger_resources_for_mode(target_mode):
    filtered_resources = requested_resources_for_mode(target_mode)
    if filtered_resources:
        return filtered_resources
    if target_mode == "only-db":
        return ["data-infra", "postgres", "redis"]
    resources = list(COMMON_TRIGGER_RESOURCES)
    if target_mode == "dev":
        resources.append("warm-routes")
    return resources


def tilt_args_argv(target_mode):
    return (
        ["tilt", "args"]
        + requested_resources_for_mode(target_mode)
        + ["--", "--mode", target_mode]
    )


def switch_mode_cmd(target_mode):
    return shell_join(tilt_args_argv(target_mode))


def mode_resource_cmd():
    base_cmd = (
        'printf "\\n==============================\\nACTIVE MODE: %%s\\n==============================\\n" "%s"'
        % mode.upper()
    )
    for resource in trigger_resources_for_mode(mode):
        base_cmd += " && " + shell_join(["tilt", "trigger", resource])
    return base_cmd


def kubectl(args):
    return "kubectl --context=%s %s" % (kind_context, args)


KIND_NODE_IP_CMD = kubectl(
    "get nodes -o jsonpath='{.items[0].status.addresses[?(@.type==\"InternalIP\")].address}'"
)

WAIT_FOR_INGRESS_CMD = (
    "set -e; "
    + "if ! "
    + kubectl(
        "-n ingress-nginx get deployment ingress-nginx-controller >/dev/null 2>&1"
    )
    + "; then "
    + "echo 'Installing ingress-nginx for Kind.'; "
    + kubectl("apply -f %s" % INGRESS_NGINX_DEPLOY_URL)
    + "; "
    + "fi; "
    + "echo 'Configuring ingress-nginx to allow this project ingress annotations.'; "
    + kubectl(
        '-n ingress-nginx patch configmap ingress-nginx-controller --type merge -p \'{"data":{"allow-snippet-annotations":"true","annotations-risk-level":"Critical"}}\''
    )
    + "; "
    + "echo 'Waiting for the ingress to be ready.' && "
    + "echo '> kubectl --context=%s wait --namespace ingress-nginx --for=condition=available deployment/ingress-nginx-controller' && "
    + kubectl(
        "wait --namespace ingress-nginx --for=condition=available deployment/ingress-nginx-controller --timeout=120s"
    )
    + "; "
    + "KIND_NODE_IP=$("
    + KIND_NODE_IP_CMD
    + "); "
    + 'echo "Kind ingress is reachable at http://'
    + PROJECT_DOMAIN
    + "/ when /etc/hosts contains: $KIND_NODE_IP "
    + PROJECT_DOMAIN
    + '"; '
    + "echo 'Removing ingress-nginx admission webhook for local Kind development.'; "
    + kubectl(
        "delete validatingwebhookconfiguration ingress-nginx-admission --ignore-not-found"
    )
) % kind_context

local_resource(
    MODE_RESOURCE,
    cmd=mode_resource_cmd(),
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO,
    labels=[SETUP_LABEL],
)

cmd_button(
    name="switch-to-dev-mode",
    argv=["sh", "-ec", switch_mode_cmd("dev")],
    location=location.NAV,
    icon_name="code",
    text="Dev%s" % (" ✓" if mode == "dev" else ""),
)

cmd_button(
    name="switch-to-test-mode",
    argv=["sh", "-ec", switch_mode_cmd("test")],
    location=location.NAV,
    icon_name="science",
    text="Test%s" % (" ✓" if mode == "test" else ""),
)

cmd_button(
    name="switch-to-dev-mode-inline",
    resource=MODE_RESOURCE,
    argv=["sh", "-ec", switch_mode_cmd("dev")],
    icon_name="code",
    text="Switch to dev%s" % (" (active)" if mode == "dev" else ""),
)

cmd_button(
    name="switch-to-test-mode-inline",
    resource=MODE_RESOURCE,
    argv=["sh", "-ec", switch_mode_cmd("test")],
    icon_name="science",
    text="Switch to test%s" % (" (active)" if mode == "test" else ""),
)

cmd_button(
    name="switch-to-only-db-mode",
    argv=["sh", "-ec", switch_mode_cmd("only-db")],
    location=location.NAV,
    icon_name="storage",
    text="Only-DB%s" % (" ✓" if mode == "only-db" else ""),
)

cmd_button(
    name="switch-to-only-db-mode-inline",
    resource=MODE_RESOURCE,
    argv=["sh", "-ec", switch_mode_cmd("only-db")],
    icon_name="storage",
    text="Switch to only-db%s" % (" (active)" if mode == "only-db" else ""),
)

if mode in ["dev", "test"]:
    local_resource(
        WAIT_FOR_INGRESS,
        cmd=WAIT_FOR_INGRESS_CMD,
        trigger_mode=TRIGGER_MODE_AUTO,
        labels=[SETUP_LABEL],
        resource_deps=[MODE_RESOURCE],
    )

BASE_SUPPORT_OBJECTS = [
    "headless-lms-inspector:serviceaccount",
    "tmc-account:serviceaccount",
    "headless-lms-readonly:role",
    "tmc-role:role",
    "headless-lms-readonly-binding:rolebinding",
    "tmc-role:rolebinding",
    "headless-lms-secrets:secret",
    "access-ingress-internally:service:ingress-nginx",
    "project-331-ingress:ingress",
    "project-331-other-domains:ingress",
]

DATA_INFRA_OBJECTS = [
    "postgres-pv:persistentvolume",
    "postgres-pvc:persistentvolumeclaim",
    "postgres-configuration:configmap",
    "postgres-credentials:secret",
    "redis-pv:persistentvolume",
    "redis-pvc:persistentvolumeclaim",
    "redis-configuration:configmap",
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
        labels=[SETUP_LABEL],
    )


def configure_data_infra_resource():
    k8s_resource(
        objects=DATA_INFRA_OBJECTS,
        new_name=DATA_INFRA_RESOURCE,
        labels=["data"],
    )


def configure_k8s_resources():
    for workload in WEB_WORKLOADS:
        k8s_resource(
            workload=workload, resource_deps=[SUPPORT_RESOURCE], labels=["web"]
        )

    for workload in OTHER_HEADLESS_LMS_WORKLOADS:
        k8s_resource(
            workload=workload, resource_deps=[SUPPORT_RESOURCE], labels=["workers"]
        )

    k8s_resource(
        workload="postgres",
        port_forwards="54328:5432",
        resource_deps=[DATA_INFRA_RESOURCE],
        labels=["data"],
    )
    k8s_resource(
        workload="redis",
        port_forwards="63798:6379",
        resource_deps=[DATA_INFRA_RESOURCE],
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
    (
        "eu.gcr.io/moocfi-public/secret-project-headless-lms-production-slim:latest",
        "headless-lms",
        "Dockerfile.production.slim.dockerfile",
    ),
    (
        "eu.gcr.io/moocfi-public/secret-project-cms-production-slim:latest",
        "cms",
        "Dockerfile.production.slim.dockerfile",
    ),
    (
        "eu.gcr.io/moocfi-public/secret-project-main-frontend-production-slim:latest",
        "main-frontend",
        "Dockerfile.production.slim.dockerfile",
    ),
    (
        "eu.gcr.io/moocfi-public/secret-project-example-exercise-production-slim:latest",
        "example-exercise",
        "Dockerfile.production.slim.dockerfile",
    ),
    (
        "eu.gcr.io/moocfi-public/secret-project-quizzes-production-slim:latest",
        "quizzes",
        "Dockerfile.production.slim.dockerfile",
    ),
    (
        "eu.gcr.io/moocfi-public/secret-project-tmc-production-slim:latest",
        "tmc",
        "Dockerfile.production.slim.dockerfile",
    ),
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
    configure_data_infra_resource()

    headless_lms_live_update = [
        fall_back_on(path) for path in HEADLESS_LMS_REBUILD_DEPS
    ] + [
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
    ] + [
        (service, service, "Dockerfile", node_live_update(service))
        for service in NODE_SERVICES
    ]

    for image, service, dockerfile, live_update_steps in dev_images:
        build_image(image, service, dockerfile, live_update_steps)

    configure_k8s_resources()

    local_resource(
        "warm-routes",
        cmd="bin/warm-routes || true",
        deps=WARM_ROUTE_DEPS,
        resource_deps=WEB_WORKLOADS,
        trigger_mode=TRIGGER_MODE_AUTO,
        labels=[SETUP_LABEL],
    )

if mode == "test":
    trigger_mode(TRIGGER_MODE_MANUAL)
    k8s_yaml(kustomize("kubernetes/test"))
    configure_support_resource(BASE_SUPPORT_OBJECTS + TEST_SUPPORT_OBJECTS)
    configure_data_infra_resource()

    for image, service, dockerfile in TEST_IMAGES:
        build_image(image, service, dockerfile, [])

    configure_k8s_resources()

if mode == "only-db":
    k8s_yaml(kustomize("kubernetes/only-db"))
    configure_data_infra_resource()
    k8s_resource(
        workload="postgres",
        port_forwards="54328:5432",
        resource_deps=["data-infra"],
        labels=["data"],
    )
    k8s_resource(
        workload="redis",
        port_forwards="63798:6379",
        resource_deps=["data-infra"],
        labels=["data"],
    )
