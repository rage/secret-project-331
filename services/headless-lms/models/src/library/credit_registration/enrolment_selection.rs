//! Which of a student's enrolments the attainment is registered against. Degree before open
//! university: a degree student who also holds an open-university study right wants the credit
//! inside their degree.

use chrono::NaiveDate;
use headless_lms_utils::services::suotar::{CreditRange, ExistingAttainment, SuotarEnrolment};

use crate::credit_registrations::CreditRegistrationErrorCode;

pub const ENROLLED_STATE: &str = "ENROLLED";
pub const ATTAINED_STATE: &str = "ATTAINED";
pub const DEGREE_KIND: &str = "degree";

use super::grade_mapping::same_grade_scale;

/// Why no enrolment could carry the attainment; each variant reads differently to the student.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NoUsableEnrolment {
    /// The registry knows of no enrolment at all for this student on this course.
    None,
    /// There are enrolments, but none of them is accepted.
    NotAccepted,
    /// The study right does not cover the day the work was completed.
    StudyRightExpired,
    /// The enrolment cannot carry this many credits, which is a mismatch in our configuration.
    CreditsOutOfRange,
}

impl NoUsableEnrolment {
    pub fn error_code(self) -> CreditRegistrationErrorCode {
        match self {
            Self::None => CreditRegistrationErrorCode::EnrolmentNotFound,
            Self::NotAccepted => CreditRegistrationErrorCode::EnrolmentNotAccepted,
            Self::StudyRightExpired => CreditRegistrationErrorCode::StudyRightNotValid,
            Self::CreditsOutOfRange => CreditRegistrationErrorCode::InvalidCredits,
        }
    }

    /// Recorded on the row so the student-facing copy can be specific about what to do.
    pub fn message(self) -> &'static str {
        match self {
            Self::None => "The study registry holds no enrolment for this course.",
            Self::NotAccepted => "No enrolment for this course has been accepted.",
            Self::StudyRightExpired => {
                "No enrolment has a study right covering the completion date."
            }
            Self::CreditsOutOfRange => {
                "No enrolment can carry the credits configured for this module."
            }
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
        .filter(|enrolment| enrolment.state == ENROLLED_STATE)
        .collect();
    if accepted.is_empty() {
        return Err(NoUsableEnrolment::NotAccepted);
    }
    // Checked here rather than paid for as a round trip that comes back studyRightNotValid.
    let valid: Vec<&SuotarEnrolment> = accepted
        .into_iter()
        .filter(|enrolment| {
            enrolment
                .study_right_validity_period
                .as_ref()
                .is_none_or(|period| period.contains(criteria.attainment_date))
        })
        .collect();
    if valid.is_empty() {
        return Err(NoUsableEnrolment::StudyRightExpired);
    }
    let usable: Vec<&SuotarEnrolment> = valid
        .into_iter()
        .filter(|enrolment| credits_fit(enrolment.credits.as_ref(), criteria.credits))
        .collect();
    if usable.is_empty() {
        return Err(NoUsableEnrolment::CreditsOutOfRange);
    }
    usable
        .into_iter()
        .max_by_key(|enrolment| {
            (
                enrolment.kind == DEGREE_KIND,
                enrolment
                    .activity_period
                    .as_ref()
                    .is_some_and(|period| period.contains(criteria.attainment_date)),
                enrolment.enrolment_date_time,
            )
        })
        .ok_or(NoUsableEnrolment::None)
}

/// Slack for the f32-to-f64 widening. Real credit amounts are never finer than 0.1.
const CREDITS_TOLERANCE: f64 = 1e-4;

/// Whether an enrolment's registry-declared credit range can carry the module's credits. No range,
/// or one with `min > max`, is the registry's own data at fault, so it is never usable.
fn credits_fit(range: Option<&CreditRange>, credits: f32) -> bool {
    let Some(range) = range.filter(|range| range.min <= range.max) else {
        return false;
    };
    let credits = f64::from(credits);
    (range.min - CREDITS_TOLERANCE..=range.max + CREDITS_TOLERANCE).contains(&credits)
}

/// An attainment the registry already holds for this course unit: importing would duplicate it.
pub fn attainment_for_course_unit<'a>(
    existing: &'a [ExistingAttainment],
    course_unit_id: &str,
    assessment_item_id: &str,
) -> Option<&'a ExistingAttainment> {
    existing.iter().find(|attainment| {
        is_attained(attainment)
            && (same_id(attainment.course_unit_id.as_deref(), course_unit_id)
                || same_id(attainment.assessment_item_id.as_deref(), assessment_item_id))
    })
}

/// A blank never matches: a response that omits an id must not thereby match every attainment.
fn same_id(left: Option<&str>, right: &str) -> bool {
    left.is_some_and(|left| !left.is_empty() && left == right)
}

fn is_attained(attainment: &ExistingAttainment) -> bool {
    attainment.state.as_deref() == Some(ATTAINED_STATE)
}

/// Any attainment the registry holds, for when no enrolment names the course unit. The response is
/// scoped to one student and one course code already; the person is checked because nothing else
/// here is.
pub fn any_attained_by_person<'a>(
    existing: &'a [ExistingAttainment],
    sisu_person_id: &str,
) -> Option<&'a ExistingAttainment> {
    existing.iter().find(|attainment| {
        is_attained(attainment) && same_id(attainment.person_id.as_deref(), sisu_person_id)
    })
}

/// The attainment a submission we lost track of would have produced, matched on what we sent.
pub fn attainment_matching_submission<'a>(
    existing: &'a [ExistingAttainment],
    attainment_date: NaiveDate,
    grade_scale_id: &str,
    grade_id: &str,
) -> Option<&'a ExistingAttainment> {
    existing.iter().find(|attainment| {
        is_attained(attainment)
            && attainment.attainment_date == Some(attainment_date)
            && attainment.grade_id.as_deref() == Some(grade_id)
            && attainment
                .grade_scale_id
                .as_deref()
                .is_some_and(|scale| same_grade_scale(scale, grade_scale_id))
    })
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
            start_date: start,
            end_date: end,
        }
    }

    fn enrolment(id: &str, kind: &str) -> SuotarEnrolment {
        SuotarEnrolment {
            id: id.to_string(),
            state: ENROLLED_STATE.to_string(),
            kind: kind.to_string(),
            course_unit_id: "hy-CU-1".to_string(),
            assessment_item_id: "hy-AI-1".to_string(),
            course_unit_realisation_id: format!("hy-CUR-{id}"),
            course_unit_realisation_name: Some(LocalizedName {
                fi: Some("kurssi".to_string()),
                sv: Some("kurs".to_string()),
                en: Some("course".to_string()),
            }),
            activity_period: Some(period(date(2026, 1, 1), date(2026, 12, 31))),
            grade_scale_id: Some("sis-hyl-hyv".to_string()),
            credits: Some(CreditRange { min: 1.0, max: 5.0 }),
            study_right_id: Some("hy-SR-1".to_string()),
            study_right_validity_period: Some(period(date(2020, 1, 1), date(2030, 1, 1))),
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
        pending.state = "NOT_ENROLLED".to_string();
        let candidates = [pending];
        assert_eq!(
            select_enrolment(&candidates, criteria()),
            Err(NoUsableEnrolment::NotAccepted)
        );
    }

    #[test]
    fn a_study_right_that_does_not_cover_the_completion_is_not_usable() {
        let mut expired = enrolment("a", DEGREE_KIND);
        expired.study_right_validity_period = Some(period(date(2020, 1, 1), date(2021, 1, 1)));
        let candidates = [expired];
        assert_eq!(
            select_enrolment(&candidates, criteria()),
            Err(NoUsableEnrolment::StudyRightExpired)
        );
    }

    #[test]
    fn an_enrolment_too_small_for_the_credits_is_a_configuration_problem() {
        let mut small = enrolment("a", DEGREE_KIND);
        small.credits = Some(CreditRange { min: 1.0, max: 2.0 });
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
            state: Some(ATTAINED_STATE.to_string()),
            person_id: Some("hy-hlo-1".to_string()),
            course_unit_id: Some("hy-CU-1".to_string()),
            assessment_item_id: Some("hy-AI-1".to_string()),
            course_unit_realisation_id: Some("hy-CUR-a".to_string()),
            attainment_date: Some(date(2026, 5, day)),
            registration_date: Some(date(2026, 5, day)),
            grade_scale_id: Some(scale.to_string()),
            grade_id: Some(grade.to_string()),
            passed: Some(true),
        }
    }

    #[test]
    fn an_attainment_the_registry_already_holds_is_found_before_we_import() {
        let existing = [attainment("sis-hyl-hyv", "1", 22)];
        assert!(attainment_for_course_unit(&existing, "hy-CU-1", "hy-AI-9").is_some());
        assert!(attainment_for_course_unit(&existing, "hy-CU-9", "hy-AI-9").is_none());
    }

    #[test]
    fn a_reversed_attainment_does_not_count_as_one_the_registry_holds() {
        let mut reversed = attainment("sis-hyl-hyv", "1", 22);
        reversed.state = Some("MISREGISTERED".to_string());
        let existing = [reversed];
        assert!(attainment_for_course_unit(&existing, "hy-CU-1", "hy-AI-1").is_none());
    }

    #[test]
    fn a_lost_submission_is_recognised_across_both_scale_spellings() {
        let existing = [attainment("sis-hyv-hyl", "1", 22)];
        assert!(
            attainment_matching_submission(&existing, date(2026, 5, 22), "sis-hyl-hyv", "1")
                .is_some()
        );
        assert!(
            attainment_matching_submission(&existing, date(2026, 5, 23), "sis-hyl-hyv", "1")
                .is_none()
        );
        assert!(
            attainment_matching_submission(&existing, date(2026, 5, 22), "sis-hyl-hyv", "0")
                .is_none()
        );
    }
}
