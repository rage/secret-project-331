//! Default identifier derivations for the simulated world.
//!
//! Defaults only: every control upsert may pass an id verbatim, and the seed does for anything a
//! spec asserts on.
//!
//! No id the mock mints contains a student number. These ids reach the audited call log and the
//! event details, where the scrubber passes attainment and enrolment id fields through untouched
//! and only redacts bare digit runs in free text — a student number hyphen-joined to a word would
//! survive both.

use chrono::NaiveDate;

use crate::prelude::*;

use super::world::RealisationKind;

/// Namespace for every derived id, so the same inputs reproduce the same id across restarts and CI
/// runs.
const MOCK_NAMESPACE: Uuid = Uuid::from_u128(0x005c_07a2_0001_4a5e_9e6e_c0de_0000_0001);

pub fn person_id(student_number: &str) -> String {
    format!("hy-hlo-{student_number}")
}

pub fn course_unit_id(course_code: &str) -> String {
    format!("hy-CU-{course_code}")
}

pub fn assessment_item_id(course_code: &str, kind: RealisationKind) -> String {
    format!("hy-AI-{course_code}-{}", kind.as_str())
}

/// Per (course, kind) rather than per student: a realisation is a shared teaching event, and
/// `list-by-course` returns its roster.
pub fn realisation_id(course_code: &str, kind: RealisationKind) -> String {
    format!(
        "hy-opt-cur-{}-{}",
        course_code.to_lowercase(),
        kind.as_str()
    )
}

pub fn enrolment_id(student_number: &str, kind: RealisationKind) -> String {
    format!("otm-{student_number}-{}", kind.as_str())
}

pub fn study_right_id(student_number: &str, kind: RealisationKind) -> String {
    derived(
        "otm",
        &format!("study-right|{student_number}|{}", kind.as_str()),
    )
}

pub fn product_id(course_code: &str) -> String {
    derived("otm", &format!("product|{course_code}"))
}

pub fn product_access_token(product_id: &str) -> String {
    derived("token", &format!("access-token|{product_id}"))
}

/// `attempt` distinguishes a legitimate re-submission from a replay of the same attempt, which
/// reproduces the id.
#[allow(clippy::too_many_arguments)]
pub fn submitted_attainment_id(
    student_number: &str,
    course_code: &str,
    enrolment_id: &str,
    attainment_date: NaiveDate,
    grade_scale_id: &str,
    grade_id: &str,
    credits: f64,
    attempt: u32,
) -> String {
    derived(
        "hy-kur",
        &format!(
            "submission|{student_number}|{course_code}|{enrolment_id}|{attainment_date}|{grade_scale_id}|{grade_id}|{credits}|{attempt}"
        ),
    )
}

pub fn final_attainment_id(submitted_attainment_id: &str) -> String {
    derived("otm", &format!("attainment|{submitted_attainment_id}"))
}

pub fn pushed_attainment_id(student_number: &str, course_code: &str, grade_id: &str) -> String {
    derived(
        "otm",
        &format!("existing-attainment|{student_number}|{course_code}|{grade_id}"),
    )
}

fn derived(prefix: &str, name: &str) -> String {
    format!(
        "{prefix}-{}",
        Uuid::new_v5(&MOCK_NAMESPACE, name.as_bytes())
    )
}
