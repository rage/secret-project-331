//! Serialized JSON shape for the Analysis stage workspace form (`workspace_data` on `course_designer_plan_stages`).

use serde::{Deserialize, Serialize};

use crate::prelude::*;

/// Discriminant for forward-compatible workspace payloads stored in `workspace_data`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(tag = "schema", content = "payload", rename_all = "snake_case")]
pub enum CourseDesignerStageWorkspace {
    AnalysisV1(AnalysisWorkspaceV1),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case")]
pub enum AnalysisCourseType {
    Compulsory,
    Elective,
}

/// Analysis stage form: course metadata, needs, wishes, market, resources, contributors.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case")]
pub struct AnalysisWorkspaceV1 {
    pub course_title: Option<String>,
    pub credits: Option<f64>,
    pub language: Option<String>,
    pub target_group: Option<String>,
    pub mode_synchronous: bool,
    pub mode_asynchronous: bool,
    pub open_period_i: bool,
    pub open_period_ii: bool,
    pub open_period_iii: bool,
    pub open_period_iv: bool,
    pub open_period_all: bool,
    pub responsible_teachers: Option<String>,
    pub degree_programme: Option<String>,
    pub course_type: Option<AnalysisCourseType>,
    pub students_demographic_data: Option<String>,
    pub wishes_topics: Option<String>,
    pub wishes_content_format_text: bool,
    pub wishes_content_format_video: bool,
    pub wishes_content_format_podcast: bool,
    pub wishes_content_format_xr: bool,
    pub wishes_content_format_notes: Option<String>,
    pub wishes_assessment_text: Option<String>,
    pub wishes_other_suggestions: Option<String>,
    pub market_results: Option<String>,
    pub resources_university: Option<String>,
    pub resources_purchase_budget: Option<String>,
    pub contributors_instructional_designer: Option<String>,
    pub contributors_subject_matter_experts: Option<String>,
    pub contributors_editors: Option<String>,
    pub contributors_support_staff: Option<String>,
}

impl Default for AnalysisWorkspaceV1 {
    fn default() -> Self {
        Self {
            course_title: None,
            credits: None,
            language: None,
            target_group: None,
            mode_synchronous: false,
            mode_asynchronous: false,
            open_period_i: false,
            open_period_ii: false,
            open_period_iii: false,
            open_period_iv: false,
            open_period_all: false,
            responsible_teachers: None,
            degree_programme: None,
            course_type: None,
            students_demographic_data: None,
            wishes_topics: None,
            wishes_content_format_text: false,
            wishes_content_format_video: false,
            wishes_content_format_podcast: false,
            wishes_content_format_xr: false,
            wishes_content_format_notes: None,
            wishes_assessment_text: None,
            wishes_other_suggestions: None,
            market_results: None,
            resources_university: None,
            resources_purchase_budget: None,
            contributors_instructional_designer: None,
            contributors_subject_matter_experts: None,
            contributors_editors: None,
            contributors_support_staff: None,
        }
    }
}

impl AnalysisWorkspaceV1 {
    /// Returns an error message if credits or other fields are invalid.
    pub fn validate(&self) -> ModelResult<()> {
        if let Some(c) = self.credits {
            if !c.is_finite() || c < 0.0 {
                return Err(ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "Credits must be a non-negative finite number.".to_string(),
                    None,
                ));
            }
        }
        Ok(())
    }
}

/// Parses `workspace_data` JSON from the DB into a typed envelope.
pub fn parse_workspace_data(value: Option<serde_json::Value>) -> ModelResult<Option<CourseDesignerStageWorkspace>> {
    match value {
        None => Ok(None),
        Some(v) if v.is_null() => Ok(None),
        Some(v) => {
            let parsed: CourseDesignerStageWorkspace = serde_json::from_value(v).map_err(|e| {
                ModelError::new(
                    ModelErrorType::InvalidRequest,
                    format!("Invalid workspace_data: {e}"),
                    None,
                )
            })?;
            match &parsed {
                CourseDesignerStageWorkspace::AnalysisV1(a) => a.validate()?,
            }
            Ok(Some(parsed))
        }
    }
}

/// Serializes workspace for storage; `None` clears the column.
pub fn workspace_to_json(workspace: Option<CourseDesignerStageWorkspace>) -> ModelResult<Option<serde_json::Value>> {
    match workspace {
        None => Ok(None),
        Some(w) => {
            match &w {
                CourseDesignerStageWorkspace::AnalysisV1(a) => a.validate()?,
            }
            serde_json::to_value(w).map(Some).map_err(|e| {
                ModelError::new(
                    ModelErrorType::Json,
                    format!("Failed to serialize workspace: {e}"),
                    None,
                )
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analysis_workspace_round_trip() {
        let w = AnalysisWorkspaceV1 {
            course_title: Some("Test".to_string()),
            credits: Some(5.5),
            language: Some("en".to_string()),
            target_group: None,
            mode_synchronous: true,
            mode_asynchronous: false,
            open_period_i: true,
            open_period_ii: false,
            open_period_iii: false,
            open_period_iv: false,
            open_period_all: false,
            responsible_teachers: Some("A, B".to_string()),
            degree_programme: None,
            course_type: Some(AnalysisCourseType::Elective),
            students_demographic_data: None,
            wishes_topics: None,
            wishes_content_format_text: true,
            wishes_content_format_video: false,
            wishes_content_format_podcast: false,
            wishes_content_format_xr: false,
            wishes_content_format_notes: None,
            wishes_assessment_text: None,
            wishes_other_suggestions: None,
            market_results: None,
            resources_university: None,
            resources_purchase_budget: None,
            contributors_instructional_designer: None,
            contributors_subject_matter_experts: None,
            contributors_editors: None,
            contributors_support_staff: None,
        };
        let env = CourseDesignerStageWorkspace::AnalysisV1(w.clone());
        let v = serde_json::to_value(&env).unwrap();
        assert!(v.get("payload").is_some());
        let back: CourseDesignerStageWorkspace = serde_json::from_value(v).unwrap();
        assert!(matches!(
            back,
            CourseDesignerStageWorkspace::AnalysisV1(ref a) if a.course_title.as_deref() == Some("Test")
        ));
    }
}
