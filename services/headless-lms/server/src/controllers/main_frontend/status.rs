//! Controllers for requests starting with `/api/v0/main-frontend/status`.

use crate::{
    domain::authorization::{Action, Resource, authorize},
    prelude::*,
};
use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use k8s_openapi::api::{
    apps::v1::Deployment,
    batch::v1::{CronJob, Job},
    core::v1::{Event, Pod, Service},
    networking::v1::Ingress,
};
use kube::{
    Api, Client,
    api::{ListParams, LogParams},
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
#[cfg(feature = "ts_rs")]
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PodInfo {
    pub name: String,
    pub phase: String,
    pub ready: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct DeploymentInfo {
    pub name: String,
    pub replicas: i32,
    pub ready_replicas: i32,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CronJobInfo {
    pub name: String,
    pub schedule: String,
    pub last_schedule_time: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct JobInfo {
    pub name: String,
    pub succeeded: Option<i32>,
    pub failed: Option<i32>,
    pub active: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ServiceInfo {
    pub name: String,
    pub cluster_ip: Option<String>,
    pub ports: Vec<ServicePortInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ServicePortInfo {
    pub name: Option<String>,
    pub port: i32,
    pub target_port: Option<String>,
    pub protocol: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct EventInfo {
    pub name: String,
    pub reason: Option<String>,
    pub message: Option<String>,
    pub type_: Option<String>,
    pub first_timestamp: Option<String>,
    pub last_timestamp: Option<String>,
    pub count: Option<i32>,
    pub involved_object_kind: Option<String>,
    pub involved_object_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct IngressInfo {
    pub name: String,
    pub hosts: Vec<String>,
    pub paths: Vec<String>,
    pub class_name: Option<String>,
}

pub fn get_namespace() -> String {
    std::env::var("POD_NAMESPACE").unwrap_or_else(|_| "default".to_string())
}

pub async fn get_pods(ns: &str) -> Result<Vec<PodInfo>> {
    let client = Client::try_default().await?;
    let lp = ListParams::default();
    let pods: Api<Pod> = Api::namespaced(client, ns);
    let pod_list = pods.list(&lp).await?;
    let pods_info: Vec<PodInfo> = pod_list
        .iter()
        .map(|p| {
            let name = p
                .metadata
                .name
                .as_deref()
                .unwrap_or("<unnamed>")
                .to_string();
            let phase = p
                .status
                .as_ref()
                .and_then(|s| s.phase.as_deref())
                .unwrap_or("Unknown")
                .to_string();
            let ready = p.status.as_ref().and_then(|s| {
                s.conditions.as_ref().and_then(|conditions| {
                    conditions
                        .iter()
                        .find(|c| c.type_ == "Ready")
                        .map(|c| c.status == "True")
                })
            });
            PodInfo { name, phase, ready }
        })
        .collect();
    Ok(pods_info)
}

pub async fn get_deployments(ns: &str) -> Result<Vec<DeploymentInfo>> {
    let client = Client::try_default().await?;
    let lp = ListParams::default();
    let deployments: Api<Deployment> = Api::namespaced(client, ns);
    let deploy_list = deployments.list(&lp).await?;
    let deployments_info: Vec<DeploymentInfo> = deploy_list
        .iter()
        .map(|d| {
            let name = d
                .metadata
                .name
                .as_deref()
                .unwrap_or("<unnamed>")
                .to_string();
            let replicas = d.status.as_ref().and_then(|s| s.replicas).unwrap_or(0);
            let ready_replicas = d
                .status
                .as_ref()
                .and_then(|s| s.ready_replicas)
                .unwrap_or(0);
            DeploymentInfo {
                name,
                replicas,
                ready_replicas,
            }
        })
        .collect();
    Ok(deployments_info)
}

async fn get_cronjobs(ns: &str) -> Result<Vec<CronJobInfo>> {
    let client = Client::try_default().await?;
    let lp = ListParams::default();
    let cronjobs: Api<CronJob> = Api::namespaced(client, ns);
    let cron_list = cronjobs.list(&lp).await?;
    let cronjobs_info: Vec<CronJobInfo> = cron_list
        .iter()
        .map(|cj| {
            let name = cj
                .metadata
                .name
                .as_deref()
                .unwrap_or("<unnamed>")
                .to_string();
            let schedule = cj
                .spec
                .as_ref()
                .map(|s| s.schedule.clone())
                .unwrap_or_else(|| "<no schedule>".to_string());
            let last_schedule_time = cj
                .status
                .as_ref()
                .and_then(|s| s.last_schedule_time.as_ref())
                .map(|t| t.0.format("%Y-%m-%d %H:%M:%S UTC").to_string());
            CronJobInfo {
                name,
                schedule,
                last_schedule_time,
            }
        })
        .collect();
    Ok(cronjobs_info)
}

async fn get_jobs(ns: &str) -> Result<Vec<JobInfo>> {
    let client = Client::try_default().await?;
    let lp = ListParams::default();
    let jobs: Api<Job> = Api::namespaced(client, ns);
    let job_list = jobs.list(&lp).await?;
    let jobs_info: Vec<JobInfo> = job_list
        .iter()
        .map(|j| {
            let name = j
                .metadata
                .name
                .as_deref()
                .unwrap_or("<unnamed>")
                .to_string();
            let succeeded = j.status.as_ref().and_then(|s| s.succeeded);
            let failed = j.status.as_ref().and_then(|s| s.failed);
            let active = j.status.as_ref().and_then(|s| s.active);
            JobInfo {
                name,
                succeeded,
                failed,
                active,
            }
        })
        .collect();
    Ok(jobs_info)
}

async fn get_services(ns: &str) -> Result<Vec<ServiceInfo>> {
    let client = Client::try_default().await?;
    let lp = ListParams::default();
    let services: Api<Service> = Api::namespaced(client, ns);
    let service_list = services.list(&lp).await?;
    let services_info: Vec<ServiceInfo> = service_list
        .iter()
        .map(|s| {
            let name = s
                .metadata
                .name
                .as_deref()
                .unwrap_or("<unnamed>")
                .to_string();
            let cluster_ip = s.spec.as_ref().and_then(|spec| spec.cluster_ip.clone());
            let ports: Vec<ServicePortInfo> = s
                .spec
                .as_ref()
                .and_then(|spec| spec.ports.as_ref())
                .map(|ports| {
                    ports
                        .iter()
                        .map(|p| ServicePortInfo {
                            name: p.name.clone(),
                            port: p.port,
                            target_port: p.target_port.as_ref().map(|tp| match tp {
                                k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(i) => {
                                    i.to_string()
                                }
                                k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::String(s) => {
                                    s.clone()
                                }
                            }),
                            protocol: p.protocol.clone(),
                        })
                        .collect()
                })
                .unwrap_or_default();
            ServiceInfo {
                name,
                cluster_ip,
                ports,
            }
        })
        .collect();
    Ok(services_info)
}

pub async fn get_events(ns: &str) -> Result<Vec<EventInfo>> {
    let client = Client::try_default().await?;
    let lp = ListParams::default();
    let events: Api<Event> = Api::namespaced(client, ns);
    let event_list = events.list(&lp).await?;
    let events_info: Vec<EventInfo> = event_list
        .iter()
        .map(|e| {
            let name = e
                .metadata
                .name
                .as_deref()
                .unwrap_or("<unnamed>")
                .to_string();
            let reason = e.reason.clone();
            let message = e.message.clone();
            let type_ = e.type_.clone();
            let first_timestamp = e
                .first_timestamp
                .as_ref()
                .map(|t| t.0.format("%Y-%m-%d %H:%M:%S UTC").to_string());
            let last_timestamp = e
                .last_timestamp
                .as_ref()
                .map(|t| t.0.format("%Y-%m-%d %H:%M:%S UTC").to_string());
            let count = e.count;
            let involved_object_kind = e.involved_object.kind.clone();
            let involved_object_name = e.involved_object.name.clone();
            EventInfo {
                name,
                reason,
                message,
                type_,
                first_timestamp,
                last_timestamp,
                count,
                involved_object_kind,
                involved_object_name,
            }
        })
        .collect();
    Ok(events_info)
}

async fn get_ingresses(ns: &str) -> Result<Vec<IngressInfo>> {
    let client = Client::try_default().await?;
    let lp = ListParams::default();
    let ingresses: Api<Ingress> = Api::namespaced(client, ns);
    let ingress_list = ingresses.list(&lp).await?;
    let ingresses_info: Vec<IngressInfo> = ingress_list
        .iter()
        .map(|i| {
            let name = i
                .metadata
                .name
                .as_deref()
                .unwrap_or("<unnamed>")
                .to_string();
            let class_name = i
                .spec
                .as_ref()
                .and_then(|s| s.ingress_class_name.as_ref())
                .cloned();
            let mut hosts = Vec::new();
            let mut paths = Vec::new();
            if let Some(spec) = &i.spec {
                if let Some(rules) = &spec.rules {
                    for rule in rules {
                        if let Some(host) = &rule.host {
                            hosts.push(host.clone());
                        }
                        if let Some(http) = &rule.http {
                            for path in &http.paths {
                                paths.push(format!(
                                    "{} ({})",
                                    path.path.as_deref().unwrap_or("/"),
                                    path.path_type.as_str()
                                ));
                            }
                        }
                    }
                }
            }
            IngressInfo {
                name,
                hosts,
                paths,
                class_name,
            }
        })
        .collect();
    Ok(ingresses_info)
}

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

async fn get_pod_logs(
    ns: &str,
    pod_name: &str,
    container: Option<&str>,
    tail_lines: i64,
) -> Result<String> {
    let client = Client::try_default().await?;
    let pods: Api<Pod> = Api::namespaced(client, ns);

    let mut log_params = LogParams {
        tail_lines: Some(tail_lines),
        ..Default::default()
    };
    if let Some(container_name) = container {
        log_params.container = Some(container_name.to_string());
    }
    log_params.limit_bytes = Some(10_000_000);
    log_params.since_seconds = Some(3600);

    let logs = pods.logs(pod_name, &log_params).await?;
    Ok(logs)
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

pub fn is_critical_event(event: &EventInfo) -> bool {
    let reason = event.reason.as_deref().unwrap_or("").to_lowercase();
    let message = event.message.as_deref().unwrap_or("").to_lowercase();

    let ignored_reasons = [
        "scheduled",
        "pulled",
        "created",
        "started",
        "killing",
        "unhealthy",
    ];

    if ignored_reasons.iter().any(|r| reason.contains(r)) {
        return false;
    }

    let critical_reasons = [
        "failed",
        "backoff",
        "crashloop",
        "imagepullbackoff",
        "errimagepull",
        "invalid",
    ];

    critical_reasons
        .iter()
        .any(|r| reason.contains(r) || message.contains(r))
}

pub fn is_recent_event(event: &EventInfo) -> bool {
    let one_hour_ago = Utc::now() - Duration::hours(1);

    let check_timestamp = |ts_str: &str| -> bool {
        if let Ok(parsed) =
            DateTime::parse_from_str(&ts_str.replace(" UTC", "Z"), "%Y-%m-%d %H:%M:%S%Z")
        {
            parsed.with_timezone(&Utc) > one_hour_ago
        } else {
            false
        }
    };

    if let Some(ts) = &event.last_timestamp {
        if check_timestamp(ts) {
            return true;
        }
    }

    if let Some(ts) = &event.first_timestamp {
        if check_timestamp(ts) {
            return true;
        }
    }

    false
}

pub async fn check_system_health(ns: &str) -> Result<bool> {
    let pods = get_pods(ns).await?;
    let deployments = get_deployments(ns).await?;
    let events = get_events(ns).await?;

    let failed_pods: Vec<_> = pods.iter().filter(|p| p.phase == "Failed").collect();
    let pending_pods: Vec<_> = pods.iter().filter(|p| p.phase == "Pending").collect();
    let crashed_pods: Vec<_> = pods
        .iter()
        .filter(|p| p.phase == "Running" && p.ready == Some(false))
        .collect();

    let has_actual_failures = !failed_pods.is_empty() || !crashed_pods.is_empty();

    let active_deployments: Vec<_> = deployments.iter().filter(|d| d.replicas > 0).collect();

    let critical_deployments: Vec<_> = active_deployments
        .iter()
        .filter(|d| d.ready_replicas == 0 && d.replicas > 0)
        .collect();

    let degraded_deployments: Vec<_> = active_deployments
        .iter()
        .filter(|d| d.ready_replicas > 0 && d.ready_replicas < d.replicas)
        .collect();

    let recent_errors: Vec<_> = events
        .iter()
        .filter(|e| {
            e.type_.as_deref() == Some("Error") && is_recent_event(e) && is_critical_event(e)
        })
        .collect();

    if !failed_pods.is_empty() {
        return Ok(false);
    }

    if !crashed_pods.is_empty() {
        return Ok(false);
    }

    if !critical_deployments.is_empty() {
        if has_actual_failures || pending_pods.is_empty() {
            return Ok(false);
        }
    }

    if !degraded_deployments.is_empty() && has_actual_failures {
        return Ok(false);
    }

    if !recent_errors.is_empty() {
        return Ok(false);
    }

    Ok(true)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/pods", web::get().to(pods))
        .route("/deployments", web::get().to(deployments))
        .route("/cronjobs", web::get().to(cronjobs))
        .route("/jobs", web::get().to(jobs))
        .route("/services", web::get().to(services))
        .route("/events", web::get().to(events))
        .route("/ingresses", web::get().to(ingresses))
        .route("/pods/{pod_name}/logs", web::get().to(pod_logs));
}
