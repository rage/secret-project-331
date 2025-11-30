//! Functions for fetching data from Kubernetes API.

use super::{
    CronJobInfo, DeploymentInfo, EventInfo, IngressInfo, JobInfo, PodDisruptionBudgetInfo, PodInfo,
    ServiceInfo, ServicePortInfo,
};
use anyhow::Result;
use k8s_openapi::api::{
    apps::v1::Deployment,
    batch::v1::{CronJob, Job},
    core::v1::{Event, Pod, Service},
    networking::v1::Ingress,
    policy::v1::PodDisruptionBudget,
};
use kube::{
    Api, Client,
    api::{ListParams, LogParams},
};
use std::collections::HashMap;

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
            let labels: HashMap<String, String> = p
                .metadata
                .labels
                .clone()
                .unwrap_or_default()
                .into_iter()
                .collect();
            PodInfo {
                name,
                phase,
                ready,
                labels,
            }
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
            let selector_labels: HashMap<String, String> = d
                .spec
                .as_ref()
                .and_then(|s| s.selector.match_labels.clone())
                .unwrap_or_default()
                .into_iter()
                .collect();
            DeploymentInfo {
                name,
                replicas,
                ready_replicas,
                selector_labels,
            }
        })
        .collect();
    Ok(deployments_info)
}

pub async fn get_cronjobs(ns: &str) -> Result<Vec<CronJobInfo>> {
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

pub async fn get_jobs(ns: &str) -> Result<Vec<JobInfo>> {
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

pub async fn get_services(ns: &str) -> Result<Vec<ServiceInfo>> {
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

pub async fn get_pod_disruption_budgets(ns: &str) -> Result<Vec<PodDisruptionBudgetInfo>> {
    let client = Client::try_default().await?;
    let lp = ListParams::default();
    let pdbs: Api<PodDisruptionBudget> = Api::namespaced(client, ns);
    let pdb_list = pdbs.list(&lp).await?;
    let pdbs_info: Vec<PodDisruptionBudgetInfo> = pdb_list
        .iter()
        .map(|pdb| {
            let name = pdb
                .metadata
                .name
                .as_deref()
                .unwrap_or("<unnamed>")
                .to_string();
            let status = pdb.status.as_ref();
            let current_healthy = status.map(|s| s.current_healthy).unwrap_or(0);
            let desired_healthy = status.map(|s| s.desired_healthy).unwrap_or(0);
            let disruptions_allowed = status.map(|s| s.disruptions_allowed).unwrap_or(0);
            let expected_pods = status.map(|s| s.expected_pods).unwrap_or(0);
            let selector_labels: HashMap<String, String> = pdb
                .spec
                .as_ref()
                .and_then(|s| s.selector.as_ref())
                .and_then(|s| s.match_labels.clone())
                .unwrap_or_default()
                .into_iter()
                .collect();
            PodDisruptionBudgetInfo {
                name,
                current_healthy,
                desired_healthy,
                disruptions_allowed,
                expected_pods,
                selector_labels,
            }
        })
        .collect();
    Ok(pdbs_info)
}

pub async fn get_ingresses(ns: &str) -> Result<Vec<IngressInfo>> {
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

pub async fn get_pod_logs(
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
