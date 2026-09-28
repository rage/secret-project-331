//! What one item of a request to the study registry asks.

use chrono::NaiveDate;

use super::ids::{AttainmentId, CourseCode, StudentNumber};

/// Who a student number belongs to in Sisu.
pub(crate) struct PersonLookup {
    pub student_number: StudentNumber,
}

/// A student's enrolments and existing attainments on one course code.
pub(crate) struct EnrolmentLookup {
    pub student_number: StudentNumber,
    pub course_code: CourseCode,
}

/// One attainment to register, exactly as it goes out.
pub(crate) struct AttainmentSubmission {
    pub student_number: StudentNumber,
    pub course_code: CourseCode,
    pub enrolment_id: String,
    pub attainment_date: NaiveDate,
    pub attainment_language: String,
    pub grade_scale_id: String,
    pub grade_id: String,
    /// Already rounded to a tenth.
    pub credits: f64,
}

/// What became of one submission of ours.
pub(crate) struct VerificationRequest {
    pub submitted_attainment_id: AttainmentId,
}

/// One course code whose roster is due.
#[derive(Clone)]
pub(crate) struct RosterCode {
    pub course_code: CourseCode,
    /// The code failed in a batch before, so it goes in a request of its own.
    pub is_fetched_alone: bool,
}
