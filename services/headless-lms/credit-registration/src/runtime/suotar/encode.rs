//! Requests into Suotar's wire items, each under the requestItemId it goes out with.

use headless_lms_utils::services::suotar::{
    ImportAttainmentRequestItem, ListByCourseRequestItem, ResolveEnrolmentRequestItem,
    ResolvePersonRequestItem, ValidateCourseCodeRequestItem, VerifyAttainmentRequestItem,
};

use crate::registry::{
    AttainmentSubmission, CourseCode, EnrolmentLookup, PersonLookup, StudentNumber,
    VerificationRequest,
};

pub(super) fn person_item(
    student_number: &StudentNumber,
    request_item_id: String,
) -> ResolvePersonRequestItem {
    ResolvePersonRequestItem {
        request_item_id,
        student_number: student_number.as_secret().clone(),
    }
}

pub(super) fn person_lookup_item(
    lookup: &PersonLookup,
    request_item_id: String,
) -> ResolvePersonRequestItem {
    person_item(&lookup.student_number, request_item_id)
}

pub(super) fn enrolment_item(
    lookup: &EnrolmentLookup,
    request_item_id: String,
) -> ResolveEnrolmentRequestItem {
    ResolveEnrolmentRequestItem {
        request_item_id,
        student_number: lookup.student_number.as_secret().clone(),
        course_code: lookup.course_code.as_str().to_string(),
    }
}

pub(super) fn import_item(
    submission: &AttainmentSubmission,
    request_item_id: String,
) -> ImportAttainmentRequestItem {
    ImportAttainmentRequestItem {
        request_item_id,
        student_number: submission.student_number.as_secret().clone(),
        course_code: submission.course_code.as_str().to_string(),
        enrolment_id: submission.enrolment_id.clone(),
        attainment_date: submission.attainment_date,
        attainment_language: submission.attainment_language.clone(),
        grade_scale_id: submission.grade.grade_scale_id.clone(),
        grade_id: submission.grade.grade_id.clone(),
        credits: submission.credits.as_f64(),
    }
}

pub(super) fn verify_item(
    request: &VerificationRequest,
    request_item_id: String,
) -> VerifyAttainmentRequestItem {
    VerifyAttainmentRequestItem {
        request_item_id,
        submitted_attainment_id: request.submitted_attainment_id.as_str().to_string(),
    }
}

pub(super) fn roster_item(
    course_code: &CourseCode,
    request_item_id: String,
) -> ListByCourseRequestItem {
    ListByCourseRequestItem {
        request_item_id,
        course_code: course_code.as_str().to_string(),
    }
}

pub(super) fn course_code_item(
    course_code: &CourseCode,
    request_item_id: String,
) -> ValidateCourseCodeRequestItem {
    ValidateCourseCodeRequestItem {
        request_item_id,
        course_code: course_code.as_str().to_string(),
    }
}
