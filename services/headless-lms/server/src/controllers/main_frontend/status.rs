//! Controllers for requests starting with `/api/v0/main-frontend/status`.

use crate::{
    domain::authorization::{Action, Resource, authorize},
    domain::system_health::{
        self, HealthStatus, SystemHealthStatus, check_system_health_detailed, get_cronjobs,
        get_deployments, get_events, get_ingresses, get_jobs, get_namespace,
        get_pod_disruption_budgets, get_pod_logs, get_pods, get_services,
    },
    prelude::*,
};
use sqlx::Executor;
use std::collections::HashMap;

pub use system_health::{
    CronJobInfo, DeploymentInfo, EventInfo, IngressInfo, JobInfo, PodDisruptionBudgetInfo, PodInfo,
    ServiceInfo, ServicePortInfo,
};

/**
GET `/api/v0/main-frontend/status/pods`

Returns the status of all Pods in the current namespace.
*/
pub async fn pods(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<PodInfo>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;
    let ns = get_namespace();
    let pods = get_pods(&ns).await.map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            e.to_string(),
            None,
        )
    })?;
    token.authorized_ok(web::Json(pods))
}

/**
GET `/api/v0/main-frontend/status/deployments`

Returns the status of all Deployments in the current namespace.
*/
pub async fn deployments(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<DeploymentInfo>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;
    let ns = get_namespace();
    let deployments = get_deployments(&ns).await.map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            e.to_string(),
            None,
        )
    })?;
    token.authorized_ok(web::Json(deployments))
}

/**
GET `/api/v0/main-frontend/status/cronjobs`

Returns the status of all CronJobs in the current namespace.
*/
pub async fn cronjobs(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CronJobInfo>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;
    let ns = get_namespace();
    let cronjobs = get_cronjobs(&ns).await.map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            e.to_string(),
            None,
        )
    })?;
    token.authorized_ok(web::Json(cronjobs))
}

/**
GET `/api/v0/main-frontend/status/jobs`

Returns the status of all Jobs in the current namespace.
*/
pub async fn jobs(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<JobInfo>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;
    let ns = get_namespace();
    let jobs = get_jobs(&ns).await.map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            e.to_string(),
            None,
        )
    })?;
    token.authorized_ok(web::Json(jobs))
}

/**
GET `/api/v0/main-frontend/status/services`

Returns the status of all Services in the current namespace.
*/
pub async fn services(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ServiceInfo>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;
    let ns = get_namespace();
    let services = get_services(&ns).await.map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            e.to_string(),
            None,
        )
    })?;
    token.authorized_ok(web::Json(services))
}

/**
GET `/api/v0/main-frontend/status/events`

Returns the status of all Events in the current namespace.
*/
pub async fn events(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<EventInfo>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;
    let ns = get_namespace();
    let events = get_events(&ns).await.map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            e.to_string(),
            None,
        )
    })?;
    token.authorized_ok(web::Json(events))
}

/**
GET `/api/v0/main-frontend/status/ingresses`

Returns the status of all Ingresses in the current namespace.
*/
pub async fn ingresses(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<IngressInfo>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;
    let ns = get_namespace();
    let ingresses = get_ingresses(&ns).await.map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            e.to_string(),
            None,
        )
    })?;
    token.authorized_ok(web::Json(ingresses))
}

/**
GET `/api/v0/main-frontend/status/pod-disruption-budgets`

Returns the status of all PodDisruptionBudgets in the current namespace.
*/
pub async fn pod_disruption_budgets(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<PodDisruptionBudgetInfo>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;
    let ns = get_namespace();
    let pdbs = get_pod_disruption_budgets(&ns).await.map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            e.to_string(),
            None,
        )
    })?;
    token.authorized_ok(web::Json(pdbs))
}

fn parse_and_validate_tail(tail_str: Option<&String>) -> i64 {
    const DEFAULT_TAIL_LINES: i64 = 1000;
    const MAX_TAIL_LINES: i64 = 10_000;

    match tail_str {
        Some(s) => match s.parse::<u64>() {
            Ok(val) => {
                let clamped = val.min(MAX_TAIL_LINES as u64);
                clamped as i64
            }
            Err(_) => DEFAULT_TAIL_LINES,
        },
        None => DEFAULT_TAIL_LINES,
    }
}

/**
GET `/api/v0/main-frontend/status/pods/{pod_name}/logs`

Returns logs from a specific pod.

Query parameters:
- container: Optional<String> - Container name (if pod has multiple containers)
- tail: Optional<u64> - Number of lines to tail from the end (default: 1000, max: 10000)
*/
pub async fn pod_logs(
    path: web::Path<String>,
    query: web::Query<HashMap<String, String>>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;
    let pod_name = path.into_inner();
    let ns = get_namespace();

    let container = query.get("container").map(|s| s.as_str());
    let tail = parse_and_validate_tail(query.get("tail"));

    let logs = get_pod_logs(&ns, &pod_name, container, tail)
        .await
        .map_err(|e| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                e.to_string(),
                None,
            )
        })?;

    token.authorized_ok(
        HttpResponse::Ok()
            .content_type("text/plain; charset=utf-8")
            .body(logs),
    )
}

/**
GET `/api/v0/main-frontend/status/health`

Returns detailed system health status with issues list (admin only).
*/
pub async fn health(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<SystemHealthStatus>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;
    let ns = get_namespace();
    let health_status = check_system_health_detailed(&ns).await.map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            e.to_string(),
            None,
        )
    })?;
    token.authorized_ok(web::Json(health_status))
}

/**
GET `/api/v0/main-frontend/status/system-health` Returns a boolean indicating whether the system is healthy.

Uses the same underlying checking logic as the detailed health endpoint.
Unauthenticated users get a boolean. Authenticated admins get error details on failure.
*/
pub async fn system_health(
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let ns = get_namespace();

    let db_check = conn.execute("SELECT 1").await;
    let kubernetes_health = check_system_health_detailed(&ns).await;

    let is_healthy = db_check.is_ok()
        && matches!(
            kubernetes_health,
            Ok(SystemHealthStatus {
                status: HealthStatus::Healthy,
                ..
            })
        );

    if is_healthy {
        let token = skip_authorize();
        return token.authorized_ok(web::Json(true));
    }

    if let Some(user) = user {
        authorize(
            &mut conn,
            Action::Administrate,
            Some(user.id),
            Resource::GlobalPermissions,
        )
        .await?;

        let error_msg = match (db_check, kubernetes_health) {
            (Err(e), _) => format!("Database connectivity check failed: {}", e),
            (_, Err(e)) => format!("System health check failed: {}", e),
            (_, Ok(health_status)) => {
                if health_status.issues.is_empty() {
                    "System is unhealthy".to_string()
                } else {
                    format!("System is unhealthy: {}", health_status.issues.join(", "))
                }
            }
        };

        Err(ControllerError::new(
            ControllerErrorType::InternalServerError,
            error_msg,
            None,
        ))
    } else {
        let token = skip_authorize();
        token.authorized_ok(web::Json(false))
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/pods", web::get().to(pods))
        .route("/deployments", web::get().to(deployments))
        .route("/cronjobs", web::get().to(cronjobs))
        .route("/jobs", web::get().to(jobs))
        .route("/services", web::get().to(services))
        .route("/events", web::get().to(events))
        .route("/ingresses", web::get().to(ingresses))
        .route(
            "/pod-disruption-budgets",
            web::get().to(pod_disruption_budgets),
        )
        .route("/pods/{pod_name}/logs", web::get().to(pod_logs))
        .route("/health", web::get().to(health))
        .route("/system-health", web::get().to(system_health));
}
