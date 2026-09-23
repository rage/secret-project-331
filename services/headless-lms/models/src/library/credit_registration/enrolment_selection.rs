//! Which of a student's enrolments the attainment is registered against. A study right that covers
//! the attainment date first, since Sisu refuses one that does not; then degree before open
//! university: a degree student who also holds an open-university study right wants the credit
//! inside their degree.

use chrono::{DateTime, NaiveDate, Utc};
use headless_lms_utils::services::suotar::{
    ATTAINMENT_TYPE_COURSE_UNIT, CreditRange, DatePeriod, ExistingAttainment, SuotarEnrolment,
};

use crate::credit_registrations::CreditRegistrationErrorCode;

pub const ENROLLED_STATE: &str = "ENROLLED";
pub const FAILED_STATE: &str = "FAILED";
pub const DEGREE_KIND: &str = "degree";

use super::grade_mapping::same_grade_scale;

/// Why no enrolment could carry the attainment; each variant reads differently to the student.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NoUsableEnrolment {
    /// The registry knows of no enrolment at all for this student on this course.
    None,
    /// There are enrolments, but none of them is accepted.
    NotAccepted,
    /// The enrolment cannot carry this many credits, which is a mismatch in our configuration.
    CreditsOutOfRange,
    /// The registry gives the course unit no usable credit range, so no enrolment on it can carry
    /// an attainment.
    NoCreditRange,
}

impl NoUsableEnrolment {
    pub fn error_code(self) -> CreditRegistrationErrorCode {
        match self {
            Self::None => CreditRegistrationErrorCode::EnrolmentNotFound,
            Self::NotAccepted => CreditRegistrationErrorCode::EnrolmentNotAccepted,
            Self::CreditsOutOfRange | Self::NoCreditRange => {
                CreditRegistrationErrorCode::InvalidCredits
            }
        }
    }

    /// Recorded on the row so the student-facing copy can be specific about what to do.
    pub fn message(self) -> &'static str {
        match self {
            Self::None => "The study registry holds no enrolment for this course.",
            Self::NotAccepted => "No enrolment for this course has been accepted.",
            Self::CreditsOutOfRange => {
                "No enrolment can carry the credits configured for this module."
            }
            Self::NoCreditRange => "The study registry gives no credit range for this course.",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EnrolmentCriteria {
    pub attainment_date: NaiveDate,
    pub credits: f32,
}

pub fn select_enrolment(
    enrolments: &[SuotarEnrolment],
    criteria: EnrolmentCriteria,
) -> Result<&SuotarEnrolment, NoUsableEnrolment> {
    if enrolments.is_empty() {
        return Err(NoUsableEnrolment::None);
    }
    let accepted: Vec<&SuotarEnrolment> = enrolments
        .iter()
        .filter(|enrolment| enrolment.state.as_deref() == Some(ENROLLED_STATE))
        .collect();
    if accepted.is_empty() {
        return Err(NoUsableEnrolment::NotAccepted);
    }
    if accepted
        .iter()
        .all(|enrolment| valid_range(enrolment.credits.as_ref()).is_none())
    {
        return Err(NoUsableEnrolment::NoCreditRange);
    }
    let usable: Vec<&SuotarEnrolment> = accepted
        .into_iter()
        .filter(|enrolment| credits_fit(enrolment.credits.as_ref(), criteria.credits))
        .collect();
    if usable.is_empty() {
        return Err(NoUsableEnrolment::CreditsOutOfRange);
    }
    usable
        .into_iter()
        .max_by_key(|enrolment| {
            let covers_attainment_date = |period: Option<&DatePeriod>| {
                period.is_some_and(|period| period.contains(criteria.attainment_date))
            };
            (
                // Only a preference: an unresolved study right is not proof of an invalid one.
                covers_attainment_date(enrolment.study_right_validity_period.as_ref()),
                enrolment.kind.as_deref() == Some(DEGREE_KIND),
                covers_attainment_date(enrolment.activity_period.as_ref()),
                enrolment.enrolment_date_time,
            )
        })
        .ok_or(NoUsableEnrolment::None)
}

/// Slack for the f32-to-f64 widening. Real credit amounts are never finer than 0.1.
const CREDITS_TOLERANCE: f64 = 1e-4;

/// `(min, max)`. A missing bound or `min > max` is the registry's own data at fault, and as unusable
/// as no range.
fn valid_range(range: Option<&CreditRange>) -> Option<(f64, f64)> {
    let range = range?;
    range.min.zip(range.max).filter(|(min, max)| min <= max)
}

/// Whether an enrolment's registry-declared credit range can carry the module's credits.
fn credits_fit(range: Option<&CreditRange>, credits: f32) -> bool {
    let Some((min, max)) = valid_range(range) else {
        return false;
    };
    let credits = f64::from(credits);
    (min - CREDITS_TOLERANCE..=max + CREDITS_TOLERANCE).contains(&credits)
}

/// The attainments a new one must improve on: every entry on the student and course code that is not
/// `failed`, matching the scope Suotar's own import checks against.
///
/// Suotar excludes a misregistered entry by a flag this endpoint does not pass through to us, so an
/// unrecognised `state` counts as a real attainment rather than being whitelisted away: undercounting
/// here risks a duplicate Sisu registration, which is worse than the reverse.
pub fn attained_candidates(existing: &[ExistingAttainment]) -> Vec<&ExistingAttainment> {
    existing
        .iter()
        .filter(|attainment| is_valid_attainment(attainment))
        .collect()
}

fn is_valid_attainment(attainment: &ExistingAttainment) -> bool {
    attainment.state.as_deref() != Some(FAILED_STATE)
}

/// How long after the submission its attainment may be registered and still count as its own.
const RECOVERY_REGISTRATION_WINDOW_DAYS: i64 = 2;

/// The attainment a submission we lost track of would have produced, matched on what we sent.
///
/// Suotar may move the attainment date into the study right without telling us, so an attainment
/// registered within a couple of days of `submitted_at` matches on its grade alone. The course unit
/// attainment wins over the assessment item one it is built from.
pub fn attainment_matching_submission<'a>(
    existing: &'a [ExistingAttainment],
    attainment_date: NaiveDate,
    submitted_at: Option<DateTime<Utc>>,
    grade_scale_id: &str,
    grade_id: &str,
) -> Option<&'a ExistingAttainment> {
    let submitted_on = submitted_at.map(|submitted_at| submitted_at.date_naive());
    existing
        .iter()
        .filter(|attainment| {
            is_valid_attainment(attainment)
                && (attainment.attainment_date == Some(attainment_date)
                    || attainment.registration_date.zip(submitted_on).is_some_and(
                        |(registered_on, submitted_on)| {
                            (0..=RECOVERY_REGISTRATION_WINDOW_DAYS)
                                .contains(&(registered_on - submitted_on).num_days())
                        },
                    ))
                && attainment.grade_id.as_deref() == Some(grade_id)
                && attainment
                    .grade_scale_id
                    .as_deref()
                    .is_some_and(|scale| same_grade_scale(scale, grade_scale_id))
        })
        .min_by_key(|attainment| attainment.attainment_type != ATTAINMENT_TYPE_COURSE_UNIT)
}

#[cfg(test)]
mod tests {
    use headless_lms_utils::services::suotar::{CreditRange, DatePeriod, LocalizedName};

    use super::*;
    use crate::prelude::*;

    fn date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("valid date")
    }

    fn period(start: NaiveDate, end: NaiveDate) -> DatePeriod {
        DatePeriod {
            start_date: Some(start),
            end_date: Some(end),
        }
    }

    fn enrolment(id: &str, kind: &str) -> SuotarEnrolment {
        SuotarEnrolment {
            id: id.to_string(),
            state: Some(ENROLLED_STATE.to_string()),
            kind: Some(kind.to_string()),
            course_unit_realisation_id: Some(format!("hy-CUR-{id}")),
            course_unit_realisation_name: Some(LocalizedName {
                fi: Some("kurssi".to_string()),
                sv: Some("kurs".to_string()),
                en: Some("course".to_string()),
            }),
            activity_period: Some(period(date(2026, 1, 1), date(2026, 12, 31))),
            grade_scale_id: Some("sis-hyl-hyv".to_string()),
            credits: Some(CreditRange {
                min: Some(1.0),
                max: Some(5.0),
            }),
            study_right_validity_period: None,
            enrolment_date_time: Some(Utc::now()),
        }
    }

    fn criteria() -> EnrolmentCriteria {
        EnrolmentCriteria {
            attainment_date: date(2026, 5, 22),
            credits: 5.0,
        }
    }

    #[test]
    fn nothing_to_choose_from_is_its_own_reason() {
        assert_eq!(
            select_enrolment(&[], criteria()),
            Err(NoUsableEnrolment::None)
        );
    }

    #[test]
    fn an_enrolment_that_was_never_accepted_is_not_usable() {
        let mut pending = enrolment("a", DEGREE_KIND);
        pending.state = Some("NOT_ENROLLED".to_string());
        let candidates = [pending];
        assert_eq!(
            select_enrolment(&candidates, criteria()),
            Err(NoUsableEnrolment::NotAccepted)
        );
    }

    #[test]
    fn an_enrolment_too_small_for_the_credits_is_a_configuration_problem() {
        let mut small = enrolment("a", DEGREE_KIND);
        small.credits = Some(CreditRange {
            min: Some(1.0),
            max: Some(2.0),
        });
        let candidates = [small];
        assert_eq!(
            select_enrolment(&candidates, criteria()),
            Err(NoUsableEnrolment::CreditsOutOfRange)
        );
        assert_eq!(
            NoUsableEnrolment::CreditsOutOfRange.error_code(),
            CreditRegistrationErrorCode::InvalidCredits
        );
    }

    #[test]
    fn a_degree_enrolment_wins_over_an_open_university_one() {
        let candidates = [
            enrolment("open", "openUniversity"),
            enrolment("degree", DEGREE_KIND),
        ];
        let chosen = select_enrolment(&candidates, criteria()).expect("a usable enrolment");
        assert_eq!(chosen.id, "degree");
    }

    #[test]
    fn a_study_right_covering_the_attainment_date_wins_over_the_degree_preference() {
        let mut expired_degree = enrolment("degree", DEGREE_KIND);
        expired_degree.study_right_validity_period =
            Some(period(date(2020, 1, 1), criteria().attainment_date));
        let mut open = enrolment("open", "openUniversity");
        open.study_right_validity_period = Some(period(date(2026, 1, 1), date(2026, 12, 31)));
        let candidates = [expired_degree, open];
        let chosen = select_enrolment(&candidates, criteria()).expect("a usable enrolment");
        assert_eq!(chosen.id, "open");
    }

    #[test]
    fn an_unresolved_study_right_is_still_usable() {
        let candidates = [enrolment("unresolved", DEGREE_KIND)];
        let chosen = select_enrolment(&candidates, criteria()).expect("a usable enrolment");
        assert_eq!(chosen.id, "unresolved");
    }

    #[test]
    fn a_realisation_running_when_the_work_was_done_wins_over_an_older_one() {
        let mut past = enrolment("past", DEGREE_KIND);
        past.activity_period = Some(period(date(2024, 1, 1), date(2024, 12, 31)));
        past.enrolment_date_time = Some(Utc::now());
        let mut current = enrolment("current", DEGREE_KIND);
        current.enrolment_date_time = Some(Utc::now() - chrono::Duration::days(365));
        let candidates = [past, current];
        let chosen = select_enrolment(&candidates, criteria()).expect("a usable enrolment");
        assert_eq!(chosen.id, "current");
    }

    #[test]
    fn the_most_recent_enrolment_breaks_a_remaining_tie() {
        let mut older = enrolment("older", DEGREE_KIND);
        older.enrolment_date_time = Some(Utc::now() - chrono::Duration::days(30));
        let candidates = [older, enrolment("newer", DEGREE_KIND)];
        let chosen = select_enrolment(&candidates, criteria()).expect("a usable enrolment");
        assert_eq!(chosen.id, "newer");
    }

    fn attainment(scale: &str, grade: &str, day: u32) -> ExistingAttainment {
        ExistingAttainment {
            id: format!("hy-att-{day}"),
            attainment_type: "CourseUnitAttainment".to_string(),
            state: Some("ATTAINED".to_string()),
            attainment_date: Some(date(2026, 5, day)),
            registration_date: Some(date(2026, 5, day)),
            grade_scale_id: Some(scale.to_string()),
            grade_id: Some(grade.to_string()),
        }
    }

    #[test]
    fn a_failed_attempt_does_not_count_as_one_the_registry_holds() {
        let mut failed = attainment("sis-0-5", "0", 22);
        failed.state = Some(FAILED_STATE.to_string());
        let existing = [failed];
        assert!(attained_candidates(&existing).is_empty());
    }

    #[test]
    fn a_lost_submission_is_recognised_across_both_scale_spellings() {
        let existing = [attainment("sis-hyv-hyl", "1", 22)];
        assert!(
            attainment_matching_submission(&existing, date(2026, 5, 22), None, "sis-hyl-hyv", "1")
                .is_some()
        );
        assert!(
            attainment_matching_submission(&existing, date(2026, 5, 23), None, "sis-hyl-hyv", "1")
                .is_none()
        );
        assert!(
            attainment_matching_submission(&existing, date(2026, 5, 22), None, "sis-hyl-hyv", "0")
                .is_none()
        );
    }
}
