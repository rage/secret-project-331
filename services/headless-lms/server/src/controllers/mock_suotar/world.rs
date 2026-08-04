//! The simulated Sisu world: entities, the submission lifecycle, the world-shaped behaviours, and
//! the per-request working set the endpoints resolve over.
//!
//! Plain values only, so the resolution logic stays a pure function over an in-memory slice.

use std::collections::BTreeMap;

use chrono::NaiveDate;
use headless_lms_models::suotar_api_calls::SuotarEndpoint;

use crate::prelude::*;

pub type StudentNumber = String;
pub type CourseCode = String;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EnrolmentState {
    Enrolled,
    Processing,
    Rejected,
    Aborted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AttainmentState {
    Attained,
    Misregistered,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RealisationKind {
    Degree,
    OpenUniversity,
}

impl RealisationKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Degree => "degree",
            Self::OpenUniversity => "openUniversity",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProductTokenState {
    Enabled,
    Disabled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProductDocumentState {
    Active,
    Draft,
    Deleted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DuplicateDetection {
    Detect,
    AllowDoubles,
}

/// When a submission becomes a real Sisu attainment. There is no clock: something has to transition
/// it, and which mechanism does is per-submission data rather than a mode the mock runs in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Ripeness {
    /// Registers inside the `import` that creates it, so import answers `registered`.
    AtImport,
    /// Only an explicit control transition registers it. What every installed world sets.
    Manual,
    /// Registers once more than `calls` verify calls have named it. Unsafe for a spec: every unscoped
    /// tick's verify sweep burns the count.
    AutoAfterVerifyCalls { calls: u32 },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SubmissionLifecycle {
    Pending {
        ripeness: Ripeness,
    },
    Registered {
        attainment_id: String,
        registered_at: DateTime<Utc>,
    },
    Misregistered {
        attainment_id: String,
        misregistered_at: DateTime<Utc>,
    },
    TimedOutNothingLanded,
    TimedOutButLanded {
        ripeness: Ripeness,
    },
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonBehaviour {
    pub ripeness: Option<Ripeness>,
    /// Per person rather than global: switching it off globally would hide real double submissions
    /// from every concurrent spec.
    pub duplicate_detection: Option<DuplicateDetection>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseBehaviour {
    pub import_allowed: bool,
}

impl Default for CourseBehaviour {
    fn default() -> Self {
        Self {
            import_allowed: true,
        }
    }
}

/// The wire's own shapes, so a world dump can be edited and pushed straight back.
pub use super::wire::{CreditRange, DatePeriod, LocalizedName};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockPerson {
    pub student_number: StudentNumber,
    pub person_id: String,
    pub first_names: String,
    pub last_name: String,
    pub primary_email: String,
    pub secondary_email: Option<String>,
    #[serde(default)]
    pub behaviour: PersonBehaviour,
    /// The account this person belongs to, so a fault can be addressed by user rather than by raw
    /// student number.
    pub owner_user_email: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockRealisation {
    pub id: String,
    pub name: LocalizedName,
    pub assessment_item_id: String,
    pub kind: RealisationKind,
    pub activity_period: DatePeriod,
    pub grade_scale_id: String,
    pub credits: CreditRange,
    pub acceptor_person_id: Option<String>,
    pub open_university_product_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockCourseUnit {
    pub course_code: CourseCode,
    pub course_unit_id: String,
    pub name: LocalizedName,
    pub realisations: Vec<MockRealisation>,
    #[serde(default)]
    pub behaviour: CourseBehaviour,
    /// The courses.mooc.fi course this unit is a module of; a slug spans every module, which is the
    /// granularity a tick scope has.
    pub owner_course_slug: Option<String>,
}

impl MockCourseUnit {
    pub fn realisation(&self, id: &str) -> Option<&MockRealisation> {
        self.realisations.iter().find(|r| r.id == id)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockEnrolment {
    pub id: String,
    pub student_number: StudentNumber,
    pub course_code: CourseCode,
    pub realisation_id: String,
    pub state: EnrolmentState,
    pub study_right_id: String,
    pub study_right_validity_period: DatePeriod,
    pub enrolment_date_time: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockAttainment {
    pub id: String,
    #[serde(rename = "type")]
    pub attainment_type: String,
    pub state: AttainmentState,
    pub person_id: String,
    pub student_number: StudentNumber,
    pub course_code: CourseCode,
    pub course_unit_id: String,
    pub assessment_item_id: String,
    pub course_unit_realisation_id: String,
    pub attainment_date: NaiveDate,
    pub registration_date: NaiveDate,
    pub grade_scale_id: String,
    pub grade_id: String,
    pub passed: bool,
    /// Set when the attainment came from a submission of ours rather than from pushed fixture data.
    pub from_submission: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockSubmission {
    pub submitted_attainment_id: String,
    pub submitted_attainment_type: String,
    pub student_number: StudentNumber,
    pub course_code: CourseCode,
    pub enrolment_id: String,
    pub realisation_id: String,
    /// Denormalised from the course unit at import time, so ripening needs only the submission.
    pub person_id: String,
    pub course_unit_id: String,
    pub assessment_item_id: String,
    pub attainment_date: NaiveDate,
    pub attainment_language: String,
    pub grade_scale_id: String,
    pub grade_id: String,
    pub credits: f64,
    pub lifecycle: SubmissionLifecycle,
    pub verify_calls: u32,
    pub id_disclosed_to_client: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockProductAccessToken {
    pub open_university_product_id: String,
    pub id: String,
    pub access_token: String,
    pub state: ProductTokenState,
    pub document_state: ProductDocumentState,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Grade {
    pub id: String,
    pub rank: i32,
    pub passed: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GradeScale {
    pub id: String,
    /// Other spellings that resolve to this scale. Responses echo the spelling the world stores.
    #[serde(default)]
    pub aliases: Vec<String>,
    pub grades: Vec<Grade>,
}

impl GradeScale {
    pub fn answers_to(&self, id: &str) -> bool {
        self.id == id || self.aliases.iter().any(|alias| alias == id)
    }

    pub fn grade(&self, grade_id: &str) -> Option<&Grade> {
        self.grades.iter().find(|grade| grade.id == grade_id)
    }
}

/// Every field defaults, so a partial `defaults` push cannot install an empty accepted token and 401
/// the whole suite.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WorldDefaults {
    pub accepted_token: String,
    pub ripeness: Ripeness,
    pub duplicate_detection: DuplicateDetection,
    pub grade_scales: Vec<GradeScale>,
    pub call_log_capacity: usize,
    pub include_non_enrolled_in_result: bool,
    pub realisation_id_required: bool,
    /// Suotar has not said what code a statically unknown grade id gets; this tries the alternative
    /// reading without a code change.
    pub static_grade_error_code: Option<String>,
}

impl Default for WorldDefaults {
    fn default() -> Self {
        Self {
            accepted_token: headless_lms_base::config::MOCK_SUOTAR_TOKEN.to_string(),
            ripeness: Ripeness::Manual,
            duplicate_detection: DuplicateDetection::Detect,
            grade_scales: default_grade_scales(),
            call_log_capacity: 2000,
            include_non_enrolled_in_result: false,
            realisation_id_required: false,
            static_grade_error_code: None,
        }
    }
}

impl WorldDefaults {
    pub fn scale(&self, id: &str) -> Option<&GradeScale> {
        self.grade_scales.iter().find(|scale| scale.answers_to(id))
    }

    /// An unknown grade id is a request-level rejection rather than a per-item error.
    pub fn any_scale_has_grade(&self, grade_id: &str) -> bool {
        self.grade_scales
            .iter()
            .any(|scale| scale.grade(grade_id).is_some())
    }
}

/// TODO: Suotar has not confirmed whether the pass/fail scale id is `sis-hyv-hyl` or `sis-hyl-hyv`,
/// so both spellings resolve to one scale.
pub fn default_grade_scales() -> Vec<GradeScale> {
    vec![
        GradeScale {
            id: "sis-hyl-hyv".to_string(),
            aliases: vec!["sis-hyv-hyl".to_string()],
            grades: vec![
                Grade {
                    id: "0".to_string(),
                    rank: 0,
                    passed: false,
                },
                Grade {
                    id: "1".to_string(),
                    rank: 1,
                    passed: true,
                },
            ],
        },
        GradeScale {
            id: "sis-0-5".to_string(),
            aliases: Vec::new(),
            grades: (0..=5)
                .map(|value| Grade {
                    id: value.to_string(),
                    rank: value,
                    passed: value >= 1,
                })
                .collect(),
        },
    ]
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissedFault {
    pub fault_id: String,
    /// The one predicate that failed. Best-effort: recorded only when everything else matched.
    pub predicate: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordedFaults {
    pub applied: Vec<String>,
    /// Faults an earlier match beat on the same request, stage and blast radius.
    pub shadowed: Vec<String>,
    pub missed: Vec<MissedFault>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordedItem {
    pub request_item_id: String,
    pub student_number: Option<String>,
    pub course_code: Option<String>,
    pub submitted_attainment_id: Option<String>,
    pub product_id: Option<String>,
    pub status: String,
    pub code: String,
}

/// One entry of the mock's own call log: unscrubbed fake data, capped, never fed to the audited
/// tables.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordedCall {
    pub seq: u64,
    pub received_at: DateTime<Utc>,
    pub endpoint: SuotarEndpoint,
    pub correlation_id: Option<String>,
    pub authorized: bool,
    pub http_status: u16,
    pub request_level_code: Option<String>,
    pub effect: Option<String>,
    pub raw_body_truncated: String,
    pub faults: RecordedFaults,
    pub items: Vec<RecordedItem>,
}

/// One change the resolution logic wants persisted, one Redis command each.
#[derive(Debug, Clone, PartialEq)]
pub enum WorldWrite {
    UpsertSubmission(String),
    UpsertAttainment(String),
    IndexSubmission {
        student_number: StudentNumber,
        course_code: CourseCode,
        id: String,
    },
    IndexAttainment {
        student_number: StudentNumber,
        course_code: CourseCode,
        id: String,
    },
}

/// The slice of the world one request needs, read once and written back once.
#[derive(Debug, Clone, Default)]
pub struct WorkingSet {
    pub defaults: WorldDefaults,
    pub persons: BTreeMap<StudentNumber, MockPerson>,
    pub course_units: BTreeMap<CourseCode, MockCourseUnit>,
    pub enrolments: BTreeMap<String, MockEnrolment>,
    pub attainments: BTreeMap<String, MockAttainment>,
    pub submissions: BTreeMap<String, MockSubmission>,
    pub product_tokens: BTreeMap<String, MockProductAccessToken>,
    /// Existing attainment ids per `{studentNumber}|{courseCode}`.
    pub attainments_by_person_course: BTreeMap<String, Vec<String>>,
    /// Submitted attainment ids per `{studentNumber}|{courseCode}`.
    pub submissions_by_person_course: BTreeMap<String, Vec<String>>,
    pub enrolments_by_person: BTreeMap<StudentNumber, Vec<String>>,
    pub enrolments_by_realisation: BTreeMap<String, Vec<String>>,
    pub writes: Vec<WorldWrite>,
}

pub fn person_course_key(student_number: &str, course_code: &str) -> String {
    format!("{student_number}|{course_code}")
}

impl WorkingSet {
    pub fn ripeness_for(&self, student_number: &str) -> Ripeness {
        self.persons
            .get(student_number)
            .and_then(|person| person.behaviour.ripeness)
            .unwrap_or(self.defaults.ripeness)
    }

    pub fn duplicate_detection_for(&self, student_number: &str) -> DuplicateDetection {
        self.persons
            .get(student_number)
            .and_then(|person| person.behaviour.duplicate_detection)
            .unwrap_or(self.defaults.duplicate_detection)
    }
}
