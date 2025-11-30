//! System health checking logic for Kubernetes resources.

pub mod health_check;
pub mod kubernetes;

pub use health_check::{check_system_health, check_system_health_detailed};
pub use kubernetes::{
    get_cronjobs, get_deployments, get_events, get_ingresses, get_jobs, get_pod_disruption_budgets,
    get_pod_logs, get_pods, get_services,
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
    pub labels: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct DeploymentInfo {
    pub name: String,
    pub replicas: i32,
    pub ready_replicas: i32,
    pub selector_labels: HashMap<String, String>,
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

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PodDisruptionBudgetInfo {
    pub name: String,
    pub current_healthy: i32,
    pub desired_healthy: i32,
    pub disruptions_allowed: i32,
    pub expected_pods: i32,
    pub selector_labels: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Healthy,
    Warning,
    Error,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct SystemHealthStatus {
    pub status: HealthStatus,
    pub issues: Vec<String>,
}

pub fn get_namespace() -> String {
    std::env::var("POD_NAMESPACE").unwrap_or_else(|_| "default".to_string())
}
