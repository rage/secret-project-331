//! The frozen copy of what we submit.
//!
//! Written once, before the row leaves enrolment resolution, and never rewritten: a teacher
//! regrading a completion afterwards must not silently change something already sent.

use chrono::{Datelike, NaiveDate, Weekday};
use headless_lms_utils::services::suotar::SuotarEnrolment;

use crate::course_module_completions::CourseModuleCompletion;
use crate::credit_registrations::{CreditRegistrationErrorCode, PayloadSnapshot};
use crate::prelude::*;

use super::grade_mapping::{GradeSource, map_grade};

/// Everything outside the completion that the payload is built from.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PayloadSources<'a> {
    pub student_number: &'a str,
    pub sisu_person_id: &'a str,
    pub uh_course_code: Option<&'a str>,
    pub ects_credits: Option<f32>,
    pub configured_grade_scale_id: Option<&'a str>,
    pub enrolment: Option<&'a SuotarEnrolment>,
}

/// A snapshot and whatever had to be adjusted to make it acceptable.
#[derive(Debug, Clone, PartialEq)]
pub struct BuiltPayload {
    pub snapshot: PayloadSnapshot,
    /// Set when the module's credits did not fit the enrolment's range. Recorded rather than
    /// refused: a rejection over a rounding difference helps nobody.
    pub clamped_credits_from: Option<f32>,
}

pub fn build_payload_snapshot(
    completion: &CourseModuleCompletion,
    sources: PayloadSources<'_>,
) -> Result<BuiltPayload, CreditRegistrationErrorCode> {
    // The last line of defence for "never push a failure": materialize filters these out and the
    // precondition recompute blocks a row regraded downward, but this is what goes on the wire.
    if !completion.passed {
        return Err(CreditRegistrationErrorCode::NoGradeScaleMapping);
    }
    let uh_course_code = sources
        .uh_course_code
        .filter(|code| !code.trim().is_empty())
        .ok_or(CreditRegistrationErrorCode::MissingUhCourseCode)?;
    let ects_credits = sources
        .ects_credits
        .ok_or(CreditRegistrationErrorCode::MissingEctsCredits)?;
    let grade = map_grade(GradeSource {
        passed: completion.passed,
        grade: completion.grade,
        configured_grade_scale_id: sources.configured_grade_scale_id,
        enrolment_grade_scale_id: sources
            .enrolment
            .map(|enrolment| enrolment.grade_scale_id.as_str()),
    })?;
    let (credits, clamped_credits_from) = clamp_credits(ects_credits, sources.enrolment);

    Ok(BuiltPayload {
        snapshot: PayloadSnapshot {
            student_number: sources.student_number.to_string(),
            sisu_person_id: sources.sisu_person_id.to_string(),
            uh_course_code: uh_course_code.to_string(),
            selected_enrolment_id: sources.enrolment.map(|enrolment| enrolment.id.clone()),
            selected_enrolment_kind: sources.enrolment.map(|enrolment| enrolment.kind.clone()),
            selected_enrolment_realisation_id: sources
                .enrolment
                .map(|enrolment| enrolment.course_unit_realisation_id.clone()),
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
    let Some(range) = enrolment.map(|enrolment| &enrolment.credits) else {
        return (credits, None);
    };
    let clamped = f64::from(credits).clamp(range.min, range.max) as f32;
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

/// The attainment date as the university reckons it. A completion at 23:30 UTC on the 31st is the
/// 1st in Helsinki, and this date lands in an official transcript.
///
/// Finland is UTC+2, and UTC+3 under the EU's summer-time rule: from 01:00 UTC on the last Sunday
/// of March to 01:00 UTC on the last Sunday of October. Written out rather than read from a
/// timezone database, which this crate does not carry; it needs revisiting only if the EU drops
/// summer time.
pub fn helsinki_date(instant: DateTime<Utc>) -> NaiveDate {
    let offset = chrono::Duration::hours(if in_eu_summer_time(instant) { 3 } else { 2 });
    (instant + offset).date_naive()
}

fn in_eu_summer_time(instant: DateTime<Utc>) -> bool {
    let year = instant.year();
    let Some(starts) = last_sunday(year, 3).and_then(|day| day.and_hms_opt(1, 0, 0)) else {
        return false;
    };
    let Some(ends) = last_sunday(year, 10).and_then(|day| day.and_hms_opt(1, 0, 0)) else {
        return false;
    };
    let naive = instant.naive_utc();
    naive >= starts && naive < ends
}

fn last_sunday(year: i32, month: u32) -> Option<NaiveDate> {
    let first_of_next = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    }?;
    let last = first_of_next.pred_opt()?;
    Some(last - chrono::Duration::days(i64::from(last.weekday().days_since(Weekday::Sun))))
}

#[cfg(test)]
mod tests {
    use headless_lms_utils::services::suotar::{CreditRange, DatePeriod, LocalizedName};

    use super::super::grade_mapping::{NUMERIC_GRADE_SCALE_ID, PASS_FAIL_GRADE_SCALE_ID};
    use super::*;

    fn completion(passed: bool, grade: Option<i32>) -> CourseModuleCompletion {
        CourseModuleCompletion {
            id: Uuid::new_v4(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
            course_id: Uuid::new_v4(),
            course_module_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            completion_date: "2026-05-22T09:00:00Z".parse().expect("valid instant"),
            completion_registration_attempt_date: None,
            completion_language: "fi-FI".to_string(),
            eligible_for_ects: true,
            email: "student@example.com".to_string(),
            grade,
            passed,
            prerequisite_modules_completed: true,
            completion_granter_user_id: None,
            needs_to_be_reviewed: false,
        }
    }

    fn enrolment(min: f64, max: f64) -> SuotarEnrolment {
        SuotarEnrolment {
            id: "otm-enrolment".to_string(),
            state: "ENROLLED".to_string(),
            kind: "degree".to_string(),
            course_unit_id: "hy-CU-1".to_string(),
            assessment_item_id: "hy-AI-1".to_string(),
            course_unit_realisation_id: "hy-CUR-1".to_string(),
            course_unit_realisation_name: LocalizedName {
                fi: "kurssi".to_string(),
                sv: "kurs".to_string(),
                en: "course".to_string(),
            },
            activity_period: DatePeriod {
                start_date: NaiveDate::from_ymd_opt(2026, 1, 1).expect("valid date"),
                end_date: NaiveDate::from_ymd_opt(2026, 12, 31).expect("valid date"),
            },
            grade_scale_id: PASS_FAIL_GRADE_SCALE_ID.to_string(),
            credits: CreditRange { min, max },
            study_right_id: "hy-SR-1".to_string(),
            study_right_validity_period: DatePeriod {
                start_date: NaiveDate::from_ymd_opt(2020, 1, 1).expect("valid date"),
                end_date: NaiveDate::from_ymd_opt(2030, 1, 1).expect("valid date"),
            },
            enrolment_date_time: Utc::now(),
        }
    }

    fn sources<'a>(enrolment: Option<&'a SuotarEnrolment>) -> PayloadSources<'a> {
        PayloadSources {
            student_number: "012345678",
            sisu_person_id: "hy-hlo-1",
            uh_course_code: Some("TKT10001"),
            ects_credits: Some(5.0),
            configured_grade_scale_id: None,
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

    /// A rounding difference against the enrolment's range is worse to fail on than to adjust, so
    /// the nearest bound is sent and the adjustment is recorded.
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
            ),
            Err(CreditRegistrationErrorCode::MissingUhCourseCode)
        );
        assert_eq!(
            build_payload_snapshot(
                &completion(true, None),
                PayloadSources {
                    uh_course_code: Some("  "),
                    ..sources(None)
                }
            ),
            Err(CreditRegistrationErrorCode::MissingUhCourseCode)
        );
        assert_eq!(
            build_payload_snapshot(
                &completion(true, None),
                PayloadSources {
                    ects_credits: None,
                    ..sources(None)
                }
            ),
            Err(CreditRegistrationErrorCode::MissingEctsCredits)
        );
    }

    /// Registering a failure into the study registry is something nobody asked for, and this is the
    /// last place it could happen.
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
        let built = build_payload_snapshot(
            &completion(true, Some(4)),
            PayloadSources {
                configured_grade_scale_id: Some(NUMERIC_GRADE_SCALE_ID),
                ..sources(None)
            },
        )
        .unwrap();
        assert_eq!(built.snapshot.grade_id, "4");
    }

    /// The date on the transcript is the university's, not UTC's. Late-evening completions are the
    /// whole reason this is not `date_naive()`.
    #[test]
    fn the_attainment_date_is_the_helsinki_date() {
        let winter_evening: DateTime<Utc> = "2026-01-31T23:30:00Z".parse().expect("valid instant");
        assert_eq!(
            helsinki_date(winter_evening),
            NaiveDate::from_ymd_opt(2026, 2, 1).expect("valid date")
        );
        let summer_evening: DateTime<Utc> = "2026-07-31T21:30:00Z".parse().expect("valid instant");
        assert_eq!(
            helsinki_date(summer_evening),
            NaiveDate::from_ymd_opt(2026, 8, 1).expect("valid date")
        );
        let summer_afternoon: DateTime<Utc> =
            "2026-07-31T12:00:00Z".parse().expect("valid instant");
        assert_eq!(
            helsinki_date(summer_afternoon),
            NaiveDate::from_ymd_opt(2026, 7, 31).expect("valid date")
        );
    }

    #[test]
    fn summer_time_starts_and_ends_on_the_documented_sundays() {
        let before_spring: DateTime<Utc> = "2026-03-29T00:59:00Z".parse().expect("valid instant");
        let after_spring: DateTime<Utc> = "2026-03-29T01:00:00Z".parse().expect("valid instant");
        assert!(!in_eu_summer_time(before_spring));
        assert!(in_eu_summer_time(after_spring));

        let before_autumn: DateTime<Utc> = "2026-10-25T00:59:00Z".parse().expect("valid instant");
        let after_autumn: DateTime<Utc> = "2026-10-25T01:00:00Z".parse().expect("valid instant");
        assert!(in_eu_summer_time(before_autumn));
        assert!(!in_eu_summer_time(after_autumn));
    }
}
