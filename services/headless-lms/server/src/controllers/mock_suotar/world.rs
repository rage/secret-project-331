//! The simulated Sisu and Suotar world: entities, the per-submission send and importer state, and the
//! per-request working set the endpoints resolve over.
//!
//! Plain values only, so the resolution logic stays a pure function over an in-memory slice.

use std::collections::BTreeMap;

use chrono::NaiveDate;

use crate::prelude::*;

use super::wire::{ASSESSMENT_ITEM_ATTAINMENT, COURSE_UNIT_ATTAINMENT, Endpoint};
pub use super::wire::{CreditRange, DatePeriod, LocalizedName};

pub type StudentNumber = String;
pub type CourseCode = String;

/// Elements of AI and Building AI, which Suotar refuses whatever its course table says.
pub const UNSETTLED_COURSE_CODES: [&str; 9] = [
    "TKT21018",
    "AYTKT21018",
    "AYTKT21018fi",
    "AYTKT21018sv",
    "TKT210281",
    "TKT210282",
    "AYTKT21028en",
    "AYTKT210281en",
    "AYTKT210282en",
];

/// How long an unconfirmed send stays `submissionPending` before verify calls it `notRegistered`.
pub const PENDING_WINDOW_HOURS: i64 = 24;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EnrolmentState {
    Enrolled,
    Processing,
    Rejected,
    Aborted,
}

/// `Misregistered` stands for Sisu's separate misregistration flag, which the wire never shows: such
/// an attainment is listed as `ATTAINED`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AttainmentState {
    Attained,
    Misregistered,
    Failed,
}

impl AttainmentState {
    pub fn wire_state(self) -> &'static str {
        match self {
            Self::Attained | Self::Misregistered => "ATTAINED",
            Self::Failed => "FAILED",
        }
    }
}

/// Which audience a fixture realisation serves; only picks the default ids. The wire's `kind` comes
/// from the enrolment's study right id instead.
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

/// Suotar's `entries.sendState`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SendState {
    NotSent,
    Attempted,
    Accepted,
    Rejected,
}

/// What the importer's copy of Sisu holds for a submission. Only a control transition changes it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum ImporterVisibility {
    None,
    /// An assessment-item attainment under the submission's own id.
    #[serde(rename_all = "camelCase")]
    Partial {
        attainment_id: String,
    },
    #[serde(rename_all = "camelCase")]
    Final {
        attainment_id: String,
    },
    #[serde(rename_all = "camelCase")]
    Misregistered {
        attainment_id: String,
    },
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PersonBehaviour {
    /// The per-person study-right fallback finds nothing, so an enrolment without a study right of
    /// its own answers `studyRightNotValid`.
    pub study_right_unresolvable: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CourseBehaviour {
    /// The realisations have no responsible teachers, which Sisu refuses at send time.
    pub no_acceptors: bool,
    /// The importer's acceptor lookup fails, which is a request-level 503 before anything is written.
    pub acceptor_lookup_fails: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockPerson {
    pub student_number: StudentNumber,
    pub person_id: String,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    pub primary_email: Option<String>,
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
    pub name: Option<LocalizedName>,
    pub assessment_item_id: String,
    pub kind: RealisationKind,
    /// Without one the realisation is left out of list-by-course.
    pub activity_period: Option<DatePeriod>,
    /// The assessment item's own scale, which wins over the course unit's.
    pub grade_scale_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuotarCourse {
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockCourseUnit {
    pub course_code: CourseCode,
    pub course_unit_id: String,
    pub name: LocalizedName,
    pub credits: Option<CreditRange>,
    pub grade_scale_id: Option<String>,
    pub realisations: Vec<MockRealisation>,
    /// Suotar's own course row. Without it import and validation refuse the code.
    pub suotar_course: Option<SuotarCourse>,
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

    /// The scale an enrolment on this realisation is graded on.
    pub fn grade_scale_for(&self, realisation: &MockRealisation) -> Option<String> {
        realisation
            .grade_scale_id
            .clone()
            .or_else(|| self.grade_scale_id.clone())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockStudyRight {
    pub validity: DatePeriod,
    pub grant_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockEnrolment {
    pub id: String,
    pub student_number: StudentNumber,
    pub course_code: CourseCode,
    pub realisation_id: String,
    pub state: EnrolmentState,
    pub study_right_id: Option<String>,
    /// Absent when the study right did not come back from the importer.
    pub study_right: Option<MockStudyRight>,
    pub enrolment_date_time: DateTime<Utc>,
}

impl MockEnrolment {
    /// Sisu has no field for it; Suotar reads it off the study right id.
    pub fn kind(&self) -> &'static str {
        if self
            .study_right_id
            .as_deref()
            .is_some_and(|id| id.contains("avoin"))
        {
            RealisationKind::OpenUniversity.as_str()
        } else {
            RealisationKind::Degree.as_str()
        }
    }
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
    pub assessment_item_id: Option<String>,
    pub course_unit_realisation_id: Option<String>,
    pub attainment_date: NaiveDate,
    pub registration_date: NaiveDate,
    pub grade_scale_id: String,
    pub grade_id: String,
    pub passed: Option<bool>,
    /// Never on the wire, but Suotar's duplicate and improvement checks compare it. Absent counts as
    /// equal to whatever is being imported.
    pub credits: Option<f64>,
    /// Set when the attainment came from a submission of ours rather than from pushed fixture data.
    pub from_submission: Option<String>,
}

impl MockAttainment {
    /// A partial attainment is the assessment-item one under the submission's own id; a final one is
    /// the course-unit attainment Sisu builds from it.
    pub fn from_submission(
        submission: &MockSubmission,
        attainment_id: &str,
        is_final: bool,
        state: AttainmentState,
        defaults: &WorldDefaults,
        now: DateTime<Utc>,
    ) -> Self {
        let (attainment_type, assessment_item_id, course_unit_realisation_id) = if is_final {
            (COURSE_UNIT_ATTAINMENT, None, None)
        } else {
            (
                ASSESSMENT_ITEM_ATTAINMENT,
                Some(submission.assessment_item_id.clone()),
                Some(submission.realisation_id.clone()),
            )
        };
        Self {
            id: attainment_id.to_string(),
            attainment_type: attainment_type.to_string(),
            state,
            person_id: submission.person_id.clone(),
            student_number: submission.student_number.clone(),
            course_code: submission.course_code.clone(),
            course_unit_id: submission.course_unit_id.clone(),
            assessment_item_id,
            course_unit_realisation_id,
            attainment_date: submission.adjusted_completion_date,
            registration_date: now.date_naive(),
            grade_scale_id: submission.grade_scale_id.clone(),
            grade_id: submission.grade_id.clone(),
            passed: defaults
                .scale(&submission.grade_scale_id)
                .and_then(|scale| scale.grade(&submission.grade_id))
                .map(|grade| grade.passed),
            credits: Some(submission.credits),
            from_submission: Some(submission.submitted_attainment_id.clone()),
        }
    }
}

/// One of Suotar's `entries` rows: a completion written by an import, with what became of its Sisu
/// send and what the importer has seen of it since.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockSubmission {
    /// `hy-kur-<uuid>`, the id Sisu is given.
    pub submitted_attainment_id: String,
    pub request_item_id: String,
    pub student_number: StudentNumber,
    pub course_code: CourseCode,
    pub enrolment_id: String,
    pub realisation_id: String,
    pub person_id: String,
    pub course_unit_id: String,
    pub assessment_item_id: String,
    pub attainment_date: NaiveDate,
    /// Clamped into the study right; never reported back to the client.
    pub adjusted_completion_date: NaiveDate,
    pub attainment_language: String,
    pub grade_scale_id: String,
    pub grade_id: String,
    pub credits: f64,
    pub send_state: SendState,
    pub violations: Vec<String>,
    pub importer: ImporterVisibility,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Grade {
    pub id: String,
    pub passed: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GradeScale {
    pub id: String,
    pub grades: Vec<Grade>,
}

impl GradeScale {
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
    /// The scales Suotar can map a grade onto; any other scale answers `invalidGradeForGradeScale`.
    pub grade_scales: Vec<GradeScale>,
    pub call_log_capacity: usize,
}

impl Default for WorldDefaults {
    fn default() -> Self {
        Self {
            accepted_token: headless_lms_base::config::MOCK_SUOTAR_TOKEN.to_string(),
            grade_scales: default_grade_scales(),
            call_log_capacity: 2000,
        }
    }
}

impl WorldDefaults {
    pub fn scale(&self, id: &str) -> Option<&GradeScale> {
        self.grade_scales.iter().find(|scale| scale.id == id)
    }
}

pub fn default_grade_scales() -> Vec<GradeScale> {
    vec![
        GradeScale {
            id: "sis-hyl-hyv".to_string(),
            grades: vec![
                Grade {
                    id: "0".to_string(),
                    passed: false,
                },
                Grade {
                    id: "1".to_string(),
                    passed: true,
                },
            ],
        },
        GradeScale {
            id: "sis-0-5".to_string(),
            grades: (0..=5)
                .map(|value| Grade {
                    id: value.to_string(),
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
    /// `dropped` for an item a fault left out of the response; `code` is then what it would have said.
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
    pub endpoint: Endpoint,
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
    IndexSubmission {
        student_number: StudentNumber,
        course_code: CourseCode,
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
    /// Sisu's refusals per `{studentNumber}|{courseCode}`.
    pub sisu_violations: BTreeMap<String, Vec<String>>,
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
