//! The frozen copy of what we submit: written once before the row leaves enrolment resolution and
//! never rewritten, so a later regrade cannot silently change something already sent.

use headless_lms_utils::helsinki_time::helsinki_date;
use headless_lms_utils::services::suotar::SuotarEnrolment;

use crate::course_module_completions::CourseModuleCompletion;
use crate::credit_registrations::{CreditRegistrationErrorCode, PayloadSnapshot};
use crate::prelude::*;

use super::grade_mapping::{GradeSource, map_grade};

/// What the completion contributes to the payload.
#[derive(Debug, Clone, PartialEq)]
pub struct CompletionFacts {
    pub passed: bool,
    pub grade: Option<i32>,
    pub completion_date: DateTime<Utc>,
    pub completion_language: String,
}

impl From<&CourseModuleCompletion> for CompletionFacts {
    fn from(completion: &CourseModuleCompletion) -> Self {
        Self {
            passed: completion.passed,
            grade: completion.grade,
            completion_date: completion.completion_date,
            completion_language: completion.completion_language.clone(),
        }
    }
}

/// Everything outside the completion that the payload is built from.
#[derive(Debug, Clone, Copy)]
pub struct PayloadSources<'a> {
    pub student_number: &'a DbSecret,
    pub sisu_person_id: &'a DbSecret,
    pub uh_course_code: Option<&'a str>,
    pub ects_credits: Option<f32>,
    pub enrolment: Option<&'a SuotarEnrolment>,
}

/// A snapshot and whatever had to be adjusted to make it acceptable.
#[derive(Debug, Clone)]
pub struct BuiltPayload {
    pub snapshot: PayloadSnapshot,
    /// Set when the module's credits did not fit the enrolment's range; recorded, not refused.
    pub clamped_credits_from: Option<f32>,
}

pub fn build_payload_snapshot(
    completion: &CompletionFacts,
    sources: PayloadSources<'_>,
) -> Result<BuiltPayload, CreditRegistrationErrorCode> {
    // The last line of defence for "never push a failure", behind materialize's filter and the
    // precondition recompute: this is what goes on the wire.
    if !completion.passed {
        return Err(CreditRegistrationErrorCode::NoGradeScaleMapping);
    }
    let uh_course_code = sources
        .uh_course_code
        .map(str::trim)
        .filter(|code| !code.is_empty())
        .ok_or(CreditRegistrationErrorCode::MissingUhCourseCode)?;
    let ects_credits = sources
        .ects_credits
        .ok_or(CreditRegistrationErrorCode::MissingEctsCredits)?;
    let grade = map_grade(GradeSource {
        passed: completion.passed,
        grade: completion.grade,
        enrolment_grade_scale_id: sources
            .enrolment
            .and_then(|enrolment| enrolment.grade_scale_id.as_deref()),
    })?;
    let (credits, clamped_credits_from) = clamp_credits(ects_credits, sources.enrolment);

    Ok(BuiltPayload {
        snapshot: PayloadSnapshot {
            student_number: sources.student_number.clone(),
            sisu_person_id: sources.sisu_person_id.clone(),
            uh_course_code: uh_course_code.to_string(),
            selected_enrolment_id: sources.enrolment.map(|enrolment| enrolment.id.clone()),
            selected_enrolment_kind: sources
                .enrolment
                .and_then(|enrolment| enrolment.kind.clone()),
            selected_enrolment_realisation_id: sources
                .enrolment
                .and_then(|enrolment| enrolment.course_unit_realisation_id.clone()),
            selected_enrolment_realisation_name: sources
                .enrolment
                .and_then(|enrolment| enrolment.course_unit_realisation_name.as_ref())
                .and_then(|name| serde_json::to_value(name).ok()),
            attainment_date: helsinki_date(completion.completion_date),
            attainment_language: attainment_language(&completion.completion_language),
            grade_scale_id: grade.grade_scale_id,
            grade_id: grade.grade_id,
            credits,
        },
        clamped_credits_from,
    })
}

fn clamp_credits(credits: f32, enrolment: Option<&SuotarEnrolment>) -> (f32, Option<f32>) {
    let Some((min, max)) = enrolment
        .and_then(|enrolment| enrolment.credits.as_ref())
        .and_then(|range| range.min.zip(range.max))
    else {
        return (credits, None);
    };
    // Not f64::clamp, which panics if min > max: select_enrolment refuses such a range, but a wire
    // value must not be able to crash the worker whatever upstream guarantees.
    let clamped = f64::from(credits).max(min).min(max) as f32;
    if clamped == credits {
        (credits, None)
    } else {
        (clamped, Some(credits))
    }
}

/// The two-letter code the registry's examples use; our column holds forms like `fi-FI`.
fn attainment_language(completion_language: &str) -> String {
    completion_language
        .chars()
        .take_while(|c| c.is_ascii_alphabetic())
        .take(2)
        .collect::<String>()
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use std::sync::LazyLock;

    use chrono::NaiveDate;
    use headless_lms_utils::services::suotar::{CreditRange, DatePeriod, LocalizedName};

    use super::super::grade_mapping::{NUMERIC_GRADE_SCALE_ID, PASS_FAIL_GRADE_SCALE_ID};
    use super::*;

    fn completion(passed: bool, grade: Option<i32>) -> CompletionFacts {
        CompletionFacts {
            passed,
            grade,
            completion_date: "2026-05-22T09:00:00Z".parse().expect("valid instant"),
            completion_language: "fi-FI".to_string(),
        }
    }

    fn enrolment(min: f64, max: f64) -> SuotarEnrolment {
        SuotarEnrolment {
            id: "otm-enrolment".to_string(),
            state: Some("ENROLLED".to_string()),
            kind: Some("degree".to_string()),
            course_unit_realisation_id: Some("hy-CUR-1".to_string()),
            course_unit_realisation_name: Some(LocalizedName {
                fi: Some("kurssi".to_string()),
                sv: Some("kurs".to_string()),
                en: Some("course".to_string()),
            }),
            activity_period: Some(DatePeriod {
                start_date: NaiveDate::from_ymd_opt(2026, 1, 1),
                end_date: NaiveDate::from_ymd_opt(2026, 12, 31),
            }),
            grade_scale_id: Some(PASS_FAIL_GRADE_SCALE_ID.to_string()),
            credits: Some(CreditRange {
                min: Some(min),
                max: Some(max),
            }),
            study_right_validity_period: None,
            enrolment_date_time: Some(Utc::now()),
        }
    }

    static STUDENT_NUMBER: LazyLock<DbSecret> = LazyLock::new(|| DbSecret::new("012345678"));
    static SISU_PERSON_ID: LazyLock<DbSecret> = LazyLock::new(|| DbSecret::new("hy-hlo-1"));

    fn sources<'a>(enrolment: Option<&'a SuotarEnrolment>) -> PayloadSources<'a> {
        PayloadSources {
            student_number: &STUDENT_NUMBER,
            sisu_person_id: &SISU_PERSON_ID,
            uh_course_code: Some("TKT10001"),
            ects_credits: Some(5.0),
            enrolment,
        }
    }

    #[test]
    fn the_payload_takes_its_scale_from_the_chosen_enrolment() {
        let enrolment = enrolment(1.0, 5.0);
        let built =
            build_payload_snapshot(&completion(true, None), sources(Some(&enrolment))).unwrap();
        assert_eq!(built.snapshot.grade_scale_id, PASS_FAIL_GRADE_SCALE_ID);
        assert_eq!(built.snapshot.grade_id, "1");
        assert_eq!(built.snapshot.credits, 5.0);
        assert_eq!(built.clamped_credits_from, None);
        assert_eq!(
            built.snapshot.selected_enrolment_id.as_deref(),
            Some("otm-enrolment")
        );
    }

    #[test]
    fn credits_are_clamped_into_the_enrolments_range_rather_than_refused() {
        let enrolment = enrolment(1.0, 4.0);
        let built =
            build_payload_snapshot(&completion(true, None), sources(Some(&enrolment))).unwrap();
        assert_eq!(built.snapshot.credits, 4.0);
        assert_eq!(built.clamped_credits_from, Some(5.0));
    }

    #[test]
    fn a_module_with_no_course_code_or_credits_is_a_configuration_problem() {
        assert_eq!(
            build_payload_snapshot(
                &completion(true, None),
                PayloadSources {
                    uh_course_code: None,
                    ..sources(None)
                }
            )
            .err(),
            Some(CreditRegistrationErrorCode::MissingUhCourseCode)
        );
        assert_eq!(
            build_payload_snapshot(
                &completion(true, None),
                PayloadSources {
                    uh_course_code: Some("  "),
                    ..sources(None)
                }
            )
            .err(),
            Some(CreditRegistrationErrorCode::MissingUhCourseCode)
        );
        assert_eq!(
            build_payload_snapshot(
                &completion(true, None),
                PayloadSources {
                    ects_credits: None,
                    ..sources(None)
                }
            )
            .err(),
            Some(CreditRegistrationErrorCode::MissingEctsCredits)
        );
    }

    #[test]
    fn a_failed_completion_never_becomes_a_payload() {
        assert!(build_payload_snapshot(&completion(false, Some(0)), sources(None)).is_err());
    }

    #[test]
    fn the_language_is_sent_as_a_two_letter_code() {
        assert_eq!(attainment_language("fi-FI"), "fi");
        assert_eq!(attainment_language("en"), "en");
        assert_eq!(attainment_language("sv-SE"), "sv");
    }

    #[test]
    fn a_graded_completion_keeps_its_number() {
        let built = build_payload_snapshot(&completion(true, Some(4)), sources(None)).unwrap();
        assert_eq!(built.snapshot.grade_scale_id, NUMERIC_GRADE_SCALE_ID);
        assert_eq!(built.snapshot.grade_id, "4");
    }
}
