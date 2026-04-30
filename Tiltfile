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
    )


def configure_k8s_resources():
    for workload in WEB_WORKLOADS + OTHER_HEADLESS_LMS_WORKLOADS:
        k8s_resource(workload=workload, resource_deps=[SUPPORT_RESOURCE])

    k8s_resource(
        workload="postgres",
        port_forwards="54328:5432",
        resource_deps=[SUPPORT_RESOURCE],
    )
    k8s_resource(
        workload="redis",
        port_forwards="63798:6379",
        resource_deps=[SUPPORT_RESOURCE],
    )


def node_live_update(service):
    return [
        sync("services/%s/src" % service, "/app/src"),
    ]


def headless_lms_sync(path):
    return sync("services/headless-lms/%s" % path, "/app/%s" % path)


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
        live_update=live_update_steps,
    )


if mode == "dev":
    k8s_yaml(kustomize("kubernetes/dev"))
    configure_support_resource(BASE_SUPPORT_OBJECTS + DEV_SUPPORT_OBJECTS)

    headless_lms_live_update = [
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
        ("cms", "cms", "Dockerfile", node_live_update("cms")),
        ("main-frontend", "main-frontend", "Dockerfile", node_live_update("main-frontend")),
        ("example-exercise", "example-exercise", "Dockerfile", node_live_update("example-exercise")),
        ("quizzes", "quizzes", "Dockerfile", node_live_update("quizzes")),
        ("tmc", "tmc", "Dockerfile", node_live_update("tmc")),
    ]

    for image, service, dockerfile, live_update_steps in dev_images:
        build_image(image, service, dockerfile, live_update_steps)

    configure_k8s_resources()

    local_resource(
        "warm-routes",
        cmd="bin/warm-routes || true",
        resource_deps=WEB_WORKLOADS,
        trigger_mode=TRIGGER_MODE_AUTO,
    )

if mode == "test":
    trigger_mode(TRIGGER_MODE_MANUAL)
    k8s_yaml(kustomize("kubernetes/test"))
    configure_support_resource(BASE_SUPPORT_OBJECTS + TEST_SUPPORT_OBJECTS)

    for image, service, dockerfile in TEST_IMAGES:
        build_image(image, service, dockerfile, [])

    configure_k8s_resources()
