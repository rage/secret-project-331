//! Default identifier derivations for the simulated world. Every control upsert may pass an id
//! verbatim instead, and the seed does for anything a spec asserts on.
//!
//! `derived` never formats a student number into the id: these reach the audited call log and the
//! event details, where the scrubber's free-text scan only redacts bare digit runs.

use crate::prelude::*;

use super::world::RealisationKind;

/// Namespaces every derived id, so the same inputs reproduce the same id across restarts and CI runs.
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

/// Per (course, kind) rather than per student: a realisation is a shared teaching event whose roster
/// `list-by-course` returns.
pub fn realisation_id(course_code: &str, kind: RealisationKind) -> String {
    format!(
        "hy-opt-cur-{}-{}",
        course_code.to_lowercase(),
        kind.as_str()
    )
}

/// Per (student, course, kind): one person may hold enrolments of the same kind on several courses.
pub fn enrolment_id(student_number: &str, course_code: &str, kind: RealisationKind) -> String {
    derived(
        "otm-enrolment",
        &format!("enrolment|{student_number}|{course_code}|{}", kind.as_str()),
    )
}

/// Suotar reads an enrolment's kind off this id: `avoin` in it means open university.
pub fn study_right_id(student_number: &str, kind: RealisationKind) -> String {
    let prefix = match kind {
        RealisationKind::Degree => "otm-degree-sr",
        RealisationKind::OpenUniversity => "otm-avoin-sr",
    };
    derived(
        prefix,
        &format!("study-right|{student_number}|{}", kind.as_str()),
    )
}

/// Random like Suotar's own, so a resubmission of the same completion gets a new id.
pub fn submitted_attainment_id() -> String {
    format!("hy-kur-{}", Uuid::new_v4())
}

pub fn final_attainment_id(submitted_attainment_id: &str) -> String {
    derived(
        "otm-attainment",
        &format!("attainment|{submitted_attainment_id}"),
    )
}

pub fn pushed_attainment_id(student_number: &str, course_code: &str, grade_id: &str) -> String {
    derived(
        "otm-attainment",
        &format!("existing-attainment|{student_number}|{course_code}|{grade_id}"),
    )
}

fn derived(prefix: &str, name: &str) -> String {
    format!(
        "{prefix}-{}",
        Uuid::new_v5(&MOCK_NAMESPACE, name.as_bytes())
    )
}
