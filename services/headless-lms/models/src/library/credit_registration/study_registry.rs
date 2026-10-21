//! What the study registry answers, in the pipeline's own terms. The credit registration worker's
//! Suotar adapter reads Suotar's wire records into these; nothing here knows the wire format.

use chrono::NaiveDate;
use secrecy::SecretString;

use super::grade_mapping::MappedGrade;
use crate::prelude::*;

/// The final attainment type in Sisu; any other type on a registered submission is partial
/// evidence.
pub const ATTAINMENT_TYPE_COURSE_UNIT: &str = "CourseUnitAttainment";

/// Serialized into the frozen payload as `{fi, sv, en}`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LocalizedName {
    pub fi: Option<String>,
    pub sv: Option<String>,
    pub en: Option<String>,
}

/// Sisu's `LocalDateRange`: start inclusive, end exclusive, either end possibly open.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DatePeriod {
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
}

impl DatePeriod {
    /// Whether `date` falls in the range; the end date itself is already outside it, and an open
    /// end contains every date on that side.
    pub fn contains(&self, date: NaiveDate) -> bool {
        self.start_date.is_none_or(|start| start <= date)
            && self.end_date.is_none_or(|end| date < end)
    }
}

/// Sisu's credit range. An import against one missing either bound is refused.
#[derive(Debug, Clone, PartialEq)]
pub struct CreditRange {
    pub min: Option<f64>,
    pub max: Option<f64>,
}

/// One of a student's enrolments on a course code. Only the id is certain: every other field may
/// be missing or unreadable in the registry's data.
#[derive(Debug, Clone, PartialEq)]
pub struct RegistryEnrolment {
    pub id: String,
    pub state: Option<String>,
    pub kind: Option<String>,
    pub course_unit_realisation_id: Option<String>,
    pub course_unit_realisation_name: Option<LocalizedName>,
    pub activity_period: Option<DatePeriod>,
    /// The assessment item's scale, else the course unit's.
    pub grade_scale_id: Option<String>,
    /// The course unit's range; `None` when Sisu gives none, which no import can go against.
    pub credits: Option<CreditRange>,
    /// `None` when the study right could not be resolved, which is no proof it is invalid.
    pub study_right_validity_period: Option<DatePeriod>,
    pub enrolment_date_time: Option<DateTime<Utc>>,
}

/// An attainment the registry holds, or one a submission of ours created. Every field but the id
/// and the type may be missing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegistryAttainment {
    pub id: String,
    pub attainment_type: String,
    pub state: Option<String>,
    pub attainment_date: Option<NaiveDate>,
    pub registration_date: Option<NaiveDate>,
    pub grade_scale_id: Option<String>,
    pub grade_id: Option<String>,
}

impl RegistryAttainment {
    /// The grade the registry holds, or `None` when it gave no scale or no grade.
    pub fn held_grade(&self) -> Option<MappedGrade> {
        MappedGrade::from_columns(self.grade_scale_id.as_deref(), self.grade_id.as_deref())
    }

    /// The grade as a timeline line names it, with its scale: "1" is a pass on one scale and a one
    /// out of five on the other. `None` when the registry gave no grade.
    pub fn display_grade(&self) -> Option<String> {
        let grade_id = self.grade_id.as_deref()?;
        Some(match self.grade_scale_id.as_deref() {
            Some(scale) => format!("{grade_id} on {scale}"),
            None => grade_id.to_string(),
        })
    }
}

/// One person a course roster lists, once per realisation they are enrolled on.
#[derive(Debug, Clone)]
pub struct RosterPerson {
    pub student_number: SecretString,
    pub person_id: SecretString,
    pub first_names: Option<SecretString>,
    pub last_name: Option<SecretString>,
    pub primary_email: Option<SecretString>,
    pub secondary_email: Option<SecretString>,
    pub enrolment: Option<RosterEnrolment>,
}

impl RosterPerson {
    /// When the roster says they enrolled, if it says.
    pub fn enrolled_at(&self) -> Option<DateTime<Utc>> {
        self.enrolment
            .as_ref()
            .and_then(|enrolment| enrolment.enrolment_date_time)
    }
}

/// The enrolment a roster lists a person under; every field may be absent.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RosterEnrolment {
    pub id: Option<String>,
    pub course_unit_realisation_id: Option<String>,
    pub state: Option<String>,
    pub enrolment_date_time: Option<DateTime<Utc>>,
}

/// What the pipeline asks of the study registry, one variant per kind of request. The Suotar
/// adapter maps each to its endpoint.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RegistryOperation {
    ResolvePersons,
    ResolveEnrolments,
    ImportAttainments,
    VerifyAttainments,
    ListCourseRoster,
    ValidateCourseCodes,
}

impl RegistryOperation {
    /// An item this operation never answered is uncertain, not retryable: re-sending it can put a
    /// second attainment on a real transcript.
    pub fn creates_attainments(self) -> bool {
        matches!(self, Self::ImportAttainments)
    }
}

/// How a whole request to the study registry failed. Failures of single items are answers, not
/// these.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegistryErrorKind {
    /// Our credentials.
    AuthenticationFailure,
    /// Our request, including one refused before it left.
    MalformedRequest,
    /// Another refusal of the request as a whole.
    RejectedRequest,
    /// The registry's own lookups failed before anything was written or sent.
    TemporarilyUnavailable,
    ServerError,
    /// The connection itself failed, so the request provably never arrived.
    NotDelivered,
    /// The request left and no answer arrived, as on a timeout.
    NoAnswer,
    /// An answer arrived that was not a batch answer.
    ProtocolViolation,
}

impl RegistryErrorKind {
    /// Whether the registry may have acted on the request. An import that may have landed must be
    /// verified rather than re-sent, or a transcript gets a second attainment.
    pub fn may_have_been_acted_on(self) -> bool {
        !matches!(
            self,
            Self::AuthenticationFailure
                | Self::MalformedRequest
                | Self::RejectedRequest
                | Self::TemporarilyUnavailable
                | Self::NotDelivered
        )
    }

    /// Whether the registry or the network is down rather than anything being wrong with the
    /// request, so the same request may succeed once they are back.
    pub fn is_outage(self) -> bool {
        matches!(
            self,
            Self::TemporarilyUnavailable | Self::ServerError | Self::NotDelivered | Self::NoAnswer
        )
    }
}
