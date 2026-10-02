//! Rows and registry records for the pure decision tests.

use chrono::{DateTime, NaiveDate, TimeZone, Utc};
use headless_lms_data_operations::library::credit_registration::enrolment_check_schedule::{
    EnrolmentCheckGroup, EnrolmentCheckSource,
};
use headless_lms_data_operations::library::credit_registration::study_registry::{
    ATTAINMENT_TYPE_COURSE_UNIT, RegistryAttainment,
};
use headless_lms_models::credit_registrations::{CreditRegistration, CreditRegistrationState};
use uuid::Uuid;

pub(crate) fn now() -> DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 9, 1, 12, 0, 0)
        .single()
        .expect("valid time")
}

/// A fresh row in `state` that has never failed or been submitted.
pub(crate) fn registration(state: CreditRegistrationState) -> CreditRegistration {
    let at = now();
    CreditRegistration {
        id: Uuid::new_v4(),
        created_at: at,
        updated_at: at,
        deleted_at: None,
        course_module_completion_id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        course_id: Uuid::new_v4(),
        course_module_id: Uuid::new_v4(),
        course_instance_id: Uuid::new_v4(),
        state,
        state_entered_at: at,
        error_code: None,
        error_message: None,
        needs_admin_attention: false,
        enrolment_banner_dismissed_at: None,
        student_number: None,
        sisu_person_id: None,
        uh_course_code: None,
        selected_enrolment_id: None,
        selected_enrolment_kind: None,
        selected_enrolment_realisation_id: None,
        attainment_date: None,
        attainment_language: None,
        grade_scale_id: None,
        grade_id: None,
        credits: None,
        submitted_attainment_id: None,
        submitted_attainment_type: None,
        sisu_attainment_id: None,
        sisu_attainment_type: None,
        submit_retry_count: 0,
        verify_attempt_count: 0,
        next_attempt_at: at,
        first_failed_at: None,
        last_attempt_at: None,
        attempt_number: 1,
        superseded_by_id: None,
        superseded_at: None,
        enrolment_checked_at: None,
        submitted_at: None,
        registered_at: None,
        terminal_at: None,
        action_needed_email_delivery_id: None,
        registered_email_delivery_id: None,
        improvement_checked_completion_updated_at: None,
        partially_registered_at: None,
        not_registered_reimport_count: 0,
        selected_enrolment_realisation_name: None,
        resubmit_not_before: None,
        pending_superseded_by_id: None,
        no_usable_enrolment_since: None,
        enrolment_check_group: EnrolmentCheckGroup::Completed,
        enrolment_check_anchor_at: None,
        enrolment_check_step: None,
        enrolment_check_due_at: None,
        is_enrolment_check_batched: false,
        enrolment_check_source: EnrolmentCheckSource::Schedule,
        enrolment_checks_stopped_at: None,
        enrolment_check_requested_at: None,
        enrolment_check_restart_window_started_at: None,
        enrolment_check_restart_count: 0,
        seen_enrolment_ids: None,
        enrolment_check_claimed_until: None,
    }
}

pub(crate) fn date(year: i32, month: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(year, month, day).expect("valid date")
}

/// An attained course unit attainment.
pub(crate) fn attainment(
    grade_scale_id: &str,
    grade_id: &str,
    attainment_date: NaiveDate,
) -> RegistryAttainment {
    RegistryAttainment {
        id: format!("attainment-{}", Uuid::new_v4()),
        attainment_type: ATTAINMENT_TYPE_COURSE_UNIT.to_string(),
        state: Some("ATTAINED".to_string()),
        attainment_date: Some(attainment_date),
        registration_date: None,
        grade_scale_id: Some(grade_scale_id.to_string()),
        grade_id: Some(grade_id.to_string()),
    }
}
