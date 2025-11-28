//! System health checking logic.

use super::kubernetes::{get_deployments, get_events, get_pod_disruption_budgets, get_pods};
use super::{
    DeploymentInfo, EventInfo, HealthStatus, PodDisruptionBudgetInfo, PodInfo, SystemHealthStatus,
};
use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use sqlx::{Executor, PgPool};
use tracing::warn;

pub fn is_critical_event(event: &EventInfo) -> bool {
    let reason = event.reason.as_deref().unwrap_or("").to_lowercase();
    let message = event.message.as_deref().unwrap_or("").to_lowercase();

    let ignored_reasons = ["scheduled", "pulled", "created", "started", "killing"];

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

fn pod_matches_deployment(pod: &PodInfo, deployment: &DeploymentInfo) -> bool {
    if deployment.selector_labels.is_empty() {
        return false;
    }
    deployment
        .selector_labels
        .iter()
        .all(|(k, v)| pod.labels.get(k) == Some(v))
}

fn count_deployment_pods_by_phase(
    pods: &[PodInfo],
    deployment: &DeploymentInfo,
    phase: &str,
) -> usize {
    pods.iter()
        .filter(|p| p.phase == phase && pod_matches_deployment(p, deployment))
        .count()
}

fn is_deployment_covered_by_pdb<'a>(
    deployment: &DeploymentInfo,
    pdbs: &'a [PodDisruptionBudgetInfo],
) -> Option<&'a PodDisruptionBudgetInfo> {
    pdbs.iter().find(|pdb| {
        if pdb.selector_labels.is_empty() {
            return false;
        }
        pdb.selector_labels
            .iter()
            .all(|(k, v)| deployment.selector_labels.get(k) == Some(v))
    })
}

pub async fn check_system_health(ns: &str, pool: Option<&PgPool>) -> Result<bool> {
    let health = check_system_health_detailed(ns, pool).await?;
    Ok(health.status == HealthStatus::Healthy)
}

pub async fn check_system_health_detailed(
    ns: &str,
    pool: Option<&PgPool>,
) -> Result<SystemHealthStatus> {
    let pods = match get_pods(ns).await {
        Ok(p) => p,
        Err(e) => {
            return Ok(SystemHealthStatus {
                status: HealthStatus::Error,
                issues: vec![format!("Failed to fetch pods: {}", e)],
            });
        }
    };
    let deployments = match get_deployments(ns).await {
        Ok(d) => d,
        Err(e) => {
            return Ok(SystemHealthStatus {
                status: HealthStatus::Error,
                issues: vec![format!("Failed to fetch deployments: {}", e)],
            });
        }
    };
    let events = match get_events(ns).await {
        Ok(e) => e,
        Err(e) => {
            return Ok(SystemHealthStatus {
                status: HealthStatus::Error,
                issues: vec![format!("Failed to fetch events: {}", e)],
            });
        }
    };
    let (pdbs, mut pdb_issues) = match get_pod_disruption_budgets(ns).await {
        Ok(pdbs) => (pdbs, Vec::new()),
        Err(e) => {
            warn!(
                namespace = ns,
                operation = "get_pod_disruption_budgets",
                error = %e,
                "Failed to fetch Pod Disruption Budgets"
            );
            (
                Vec::new(),
                vec![format!(
                    "Pod Disruption Budget check unavailable (namespace: {}, error: {})",
                    ns, e
                )],
            )
        }
    };

    let active_pods: Vec<_> = pods.iter().filter(|p| p.phase != "Succeeded").collect();
    let failed_pods: Vec<_> = pods.iter().filter(|p| p.phase == "Failed").collect();
    let crashed_pods: Vec<_> = pods
        .iter()
        .filter(|p| p.phase == "Running" && p.ready == Some(false))
        .collect();
    let pending_pods: Vec<_> = pods.iter().filter(|p| p.phase == "Pending").collect();

    let active_deployments: Vec<_> = deployments.iter().filter(|d| d.replicas > 0).collect();

    let critical_deployments: Vec<_> = active_deployments
        .iter()
        .filter(|d| d.ready_replicas == 0 && d.replicas > 0)
        .collect();

    let degraded_deployments: Vec<_> = active_deployments
        .iter()
        .filter(|d| {
            if d.ready_replicas >= d.replicas {
                return false;
            }
            match is_deployment_covered_by_pdb(d, &pdbs) {
                Some(pdb) => pdb.disruptions_allowed <= 0 && d.ready_replicas < d.replicas,
                None => d.ready_replicas == 0,
            }
        })
        .collect();

    let recent_errors: Vec<_> = events
        .iter()
        .filter(|e| {
            e.type_.as_deref() == Some("Error") && is_recent_event(e) && is_critical_event(e)
        })
        .collect();

    let recent_warnings: Vec<_> = events
        .iter()
        .filter(|e| {
            e.type_.as_deref() == Some("Warning") && is_recent_event(e) && is_critical_event(e)
        })
        .collect();

    let mut status = HealthStatus::Healthy;
    let mut issues = Vec::new();

    if let Some(pool) = pool {
        match pool.acquire().await {
            Ok(mut conn) => {
                if let Err(e) = conn.execute("SELECT 1").await {
                    status = HealthStatus::Error;
                    issues.push(format!("Database connectivity check failed: {}", e));
                }
            }
            Err(e) => {
                status = HealthStatus::Error;
                issues.push(format!("Database connection pool check failed: {}", e));
            }
        }
    }

    if !pdb_issues.is_empty() && status == HealthStatus::Healthy {
        status = HealthStatus::Warning;
    }
    issues.append(&mut pdb_issues);

    if !failed_pods.is_empty() {
        status = HealthStatus::Error;
        issues.push(format!("{} failed pod(s)", failed_pods.len()));
    }

    if !crashed_pods.is_empty() {
        status = HealthStatus::Error;
        issues.push(format!("{} crashed pod(s)", crashed_pods.len()));
    }

    if !critical_deployments.is_empty() {
        let has_unprotected_critical =
            critical_deployments
                .iter()
                .any(|d| match is_deployment_covered_by_pdb(d, &pdbs) {
                    Some(pdb) if pdb.disruptions_allowed > 0 => false,
                    _ => {
                        let pending_count = count_deployment_pods_by_phase(&pods, d, "Pending");
                        let running_count = count_deployment_pods_by_phase(&pods, d, "Running");
                        !(pending_count > 0 && running_count > 0)
                    }
                });

        if has_unprotected_critical {
            status = HealthStatus::Error;
            issues.push(format!(
                "{} deployment(s) completely down",
                critical_deployments.len()
            ));
        }
    }

    if !recent_errors.is_empty() {
        status = HealthStatus::Error;
        issues.push(format!("{} recent error(s)", recent_errors.len()));
    }

    if !degraded_deployments.is_empty() && status == HealthStatus::Error {
        issues.push(format!(
            "{} deployment(s) degraded",
            degraded_deployments.len()
        ));
    }

    if status != HealthStatus::Error {
        let has_actual_failures = !failed_pods.is_empty() || !crashed_pods.is_empty();
        let has_only_pending_pods = !pending_pods.is_empty() && !has_actual_failures;

        if !degraded_deployments.is_empty() {
            status = HealthStatus::Warning;
            issues.push(format!(
                "{} deployment(s) degraded",
                degraded_deployments.len()
            ));
        }

        let unhealthy_deployments: Vec<_> = active_deployments
            .iter()
            .filter(|d| {
                if d.ready_replicas >= d.replicas {
                    return false;
                }
                match is_deployment_covered_by_pdb(d, &pdbs) {
                    Some(pdb) => pdb.disruptions_allowed <= 0 && d.ready_replicas < d.replicas,
                    None => d.ready_replicas == 0,
                }
            })
            .collect();
        if !unhealthy_deployments.is_empty() && has_only_pending_pods {
            status = HealthStatus::Warning;
            issues.push(format!(
                "{} unhealthy deployment(s)",
                unhealthy_deployments.len()
            ));
        }

        let pending_threshold = if active_pods.len() <= 3 {
            1
        } else {
            (active_pods.len() as f64 * 0.1) as usize
        };
        if pending_pods.len() >= pending_threshold {
            status = HealthStatus::Warning;
            issues.push(format!("{} pending pod(s)", pending_pods.len()));
        }

        if !recent_warnings.is_empty() {
            status = HealthStatus::Warning;
            issues.push(format!("{} recent warning(s)", recent_warnings.len()));
        }
    }

    Ok(SystemHealthStatus { status, issues })
}
