//! What one item of a request to the study registry asks.

use chrono::NaiveDate;
use headless_lms_data_operations::library::credit_registration::grade_mapping::MappedGrade;

use super::answers::{EnrolmentAnswer, ImportAnswer, PersonAnswer, VerificationAnswer};
use super::batch::{BatchEntry, BatchOptions, BatchReply, BatchRequest};
use super::ids::{AttainmentId, CourseCode, StudentNumber};
use super::{RegistryOperation, StudyRegistry};

/// Who a student number belongs to in Sisu.
pub(crate) struct PersonLookup {
    pub student_number: StudentNumber,
}

impl BatchRequest for PersonLookup {
    const OPERATION: RegistryOperation = RegistryOperation::ResolvePersons;
    type Answer = PersonAnswer;

    async fn send<Registry: StudyRegistry, K>(
        registry: &mut Registry,
        entries: Vec<BatchEntry<K, Self>>,
        options: BatchOptions,
    ) -> BatchReply<K, Self, PersonAnswer> {
        registry.resolve_persons(entries, options).await
    }
}

/// A student's enrolments and existing attainments on one course code.
pub(crate) struct EnrolmentLookup {
    pub student_number: StudentNumber,
    pub course_code: CourseCode,
}

impl BatchRequest for EnrolmentLookup {
    const OPERATION: RegistryOperation = RegistryOperation::ResolveEnrolments;
    type Answer = EnrolmentAnswer;

    async fn send<Registry: StudyRegistry, K>(
        registry: &mut Registry,
        entries: Vec<BatchEntry<K, Self>>,
        options: BatchOptions,
    ) -> BatchReply<K, Self, EnrolmentAnswer> {
        registry.resolve_enrolments(entries, options).await
    }
}

/// One attainment to register, exactly as it goes out.
pub(crate) struct AttainmentSubmission {
    pub student_number: StudentNumber,
    pub course_code: CourseCode,
    pub enrolment_id: String,
    pub attainment_date: NaiveDate,
    pub attainment_language: String,
    pub grade: MappedGrade,
    pub credits: Credits,
}

impl BatchRequest for AttainmentSubmission {
    const OPERATION: RegistryOperation = RegistryOperation::ImportAttainments;
    type Answer = ImportAnswer;

    async fn send<Registry: StudyRegistry, K>(
        registry: &mut Registry,
        entries: Vec<BatchEntry<K, Self>>,
        options: BatchOptions,
    ) -> BatchReply<K, Self, ImportAnswer> {
        registry.import_attainments(entries, options).await
    }
}

/// ECTS credits as they go on the wire: finite, and rounded to the tenth credits never go finer
/// than.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Credits(f64);

impl Credits {
    /// `None` for a value that is not finite, which Suotar refuses. Rounding also removes the
    /// f32-to-f64 widening error, which would send 2.7 as 2.700000047683716.
    pub(crate) fn from_stored(credits: f32) -> Option<Self> {
        credits
            .is_finite()
            .then(|| Self((f64::from(credits) * 10.0).round() / 10.0))
    }

    pub(crate) fn as_f64(self) -> f64 {
        self.0
    }
}

/// What became of one submission of ours.
pub(crate) struct VerificationRequest {
    pub submitted_attainment_id: AttainmentId,
}

impl BatchRequest for VerificationRequest {
    const OPERATION: RegistryOperation = RegistryOperation::VerifyAttainments;
    type Answer = VerificationAnswer;

    async fn send<Registry: StudyRegistry, K>(
        registry: &mut Registry,
        entries: Vec<BatchEntry<K, Self>>,
        options: BatchOptions,
    ) -> BatchReply<K, Self, VerificationAnswer> {
        registry.verify_attainments(entries, options).await
    }
}

/// One course code whose roster is due.
#[derive(Clone)]
pub(crate) struct RosterCode {
    pub course_code: CourseCode,
    /// The code failed in a batch before, so it goes in a request of its own.
    pub is_fetched_alone: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stored_credits_go_out_rounded_to_a_tenth_and_only_when_finite() {
        assert_eq!(Credits::from_stored(2.7).map(Credits::as_f64), Some(2.7));
        assert_eq!(Credits::from_stored(f32::NAN), None);
        assert_eq!(Credits::from_stored(f32::INFINITY), None);
    }
}
