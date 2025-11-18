//! Controllers for requests starting with `/api/v0/main-frontend/status`.

use crate::prelude::*;
use anyhow::Result;
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

fn get_namespace() -> String {
    std::env::var("POD_NAMESPACE").unwrap_or_else(|_| "default".to_string())
}

async fn get_pods(ns: &str) -> Result<Vec<PodInfo>> {
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

async fn get_deployments(ns: &str) -> Result<Vec<DeploymentInfo>> {
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
                            target_port: p.target_port.as_ref().and_then(|tp| match tp {
                                k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(i) => {
                                    Some(i.to_string())
                                }
                                k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::String(s) => {
                                    Some(s.clone())
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

async fn get_events(ns: &str) -> Result<Vec<EventInfo>> {
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
pub async fn pods() -> ControllerResult<web::Json<Vec<PodInfo>>> {
    let token = skip_authorize();
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
pub async fn deployments() -> ControllerResult<web::Json<Vec<DeploymentInfo>>> {
    let token = skip_authorize();
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
pub async fn cronjobs() -> ControllerResult<web::Json<Vec<CronJobInfo>>> {
    let token = skip_authorize();
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
pub async fn jobs() -> ControllerResult<web::Json<Vec<JobInfo>>> {
    let token = skip_authorize();
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
pub async fn services() -> ControllerResult<web::Json<Vec<ServiceInfo>>> {
    let token = skip_authorize();
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
pub async fn events() -> ControllerResult<web::Json<Vec<EventInfo>>> {
    let token = skip_authorize();
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
pub async fn ingresses() -> ControllerResult<web::Json<Vec<IngressInfo>>> {
    let token = skip_authorize();
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

async fn get_pod_logs(
    ns: &str,
    pod_name: &str,
    container: Option<&str>,
    tail_lines: Option<i64>,
) -> Result<String> {
    let client = Client::try_default().await?;
    let pods: Api<Pod> = Api::namespaced(client, ns);

    let mut log_params = LogParams::default();
    if let Some(tail) = tail_lines {
        log_params.tail_lines = Some(tail);
    }
    if let Some(container_name) = container {
        log_params.container = Some(container_name.to_string());
    }

    let logs = pods.logs(pod_name, &log_params).await?;
    Ok(logs)
}

/**
GET `/api/v0/main-frontend/status/pods/{pod_name}/logs`

Returns logs from a specific pod.

Query parameters:
- container: Optional<String> - Container name (if pod has multiple containers)
- tail: Optional<u64> - Number of lines to tail from the end (default: all logs)
*/
pub async fn pod_logs(
    path: web::Path<String>,
    query: web::Query<HashMap<String, String>>,
) -> ControllerResult<HttpResponse> {
    let token = skip_authorize();
    let pod_name = path.into_inner();
    let ns = get_namespace();

    let container = query.get("container").map(|s| s.as_str());
    let tail = query.get("tail").and_then(|s| s.parse::<i64>().ok());

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
