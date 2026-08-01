//! Our grade in the study registry's terms.
//!
//! Also the pre-flight the import batch depends on: a grade scale or grade the registry does not
//! know is rejected at request level, taking the whole batch of twenty-five with it. Every pair
//! that reaches a batch has been through [`map_grade`] or [`is_known_grade`].

use crate::credit_registrations::CreditRegistrationErrorCode;

/// TODO: Suotar has not confirmed the spelling. Both are accepted on the way in; this is the one we
/// send, and changing it is this line.
pub const PASS_FAIL_GRADE_SCALE_ID: &str = "sis-hyl-hyv";
/// The other accepted spelling of the same scale, which our own legacy pull path sends.
pub const PASS_FAIL_GRADE_SCALE_ID_ALT: &str = "sis-hyv-hyl";
pub const NUMERIC_GRADE_SCALE_ID: &str = "sis-0-5";

pub const PASS_GRADE_ID: &str = "1";
pub const FAIL_GRADE_ID: &str = "0";
pub const MAX_NUMERIC_GRADE: i32 = 5;

/// The scale families we can express a completion in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GradeScaleFamily {
    PassFail,
    Numeric,
}

pub fn grade_scale_family(grade_scale_id: &str) -> Option<GradeScaleFamily> {
    match grade_scale_id {
        PASS_FAIL_GRADE_SCALE_ID | PASS_FAIL_GRADE_SCALE_ID_ALT => Some(GradeScaleFamily::PassFail),
        NUMERIC_GRADE_SCALE_ID => Some(GradeScaleFamily::Numeric),
        _ => None,
    }
}

/// Whether two scale ids name the same scale. The pass/fail id has two spellings in circulation, so
/// comparing the strings would call an attainment we ourselves registered a different scale.
pub fn same_grade_scale(left: &str, right: &str) -> bool {
    match (grade_scale_family(left), grade_scale_family(right)) {
        (Some(left), Some(right)) => left == right,
        _ => left == right,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MappedGrade {
    pub grade_scale_id: String,
    pub grade_id: String,
}

/// What the completion says and what the module and the chosen enrolment say the scale should be.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GradeSource<'a> {
    pub passed: bool,
    /// `None` for a pass/fail completion.
    pub grade: Option<i32>,
    /// The module's override, which is how one course is unblocked without a deploy.
    pub configured_grade_scale_id: Option<&'a str>,
    /// The scale the chosen enrolment says the registry expects.
    pub enrolment_grade_scale_id: Option<&'a str>,
}

/// Maps a completion into the scale the registry expects, preferring what it told us over what we
/// would have guessed.
pub fn map_grade(source: GradeSource<'_>) -> Result<MappedGrade, CreditRegistrationErrorCode> {
    let scale_id = source
        .configured_grade_scale_id
        .or(source.enrolment_grade_scale_id)
        .unwrap_or(if source.grade.is_some() {
            NUMERIC_GRADE_SCALE_ID
        } else {
            PASS_FAIL_GRADE_SCALE_ID
        });
    let family =
        grade_scale_family(scale_id).ok_or(CreditRegistrationErrorCode::NoGradeScaleMapping)?;
    let grade_id = match family {
        GradeScaleFamily::PassFail => if source.passed {
            PASS_GRADE_ID
        } else {
            FAIL_GRADE_ID
        }
        .to_string(),
        GradeScaleFamily::Numeric => {
            // A pass/fail completion carries no number, and inventing one would put a grade the
            // teacher never gave on a transcript.
            let grade = source
                .grade
                .ok_or(CreditRegistrationErrorCode::NoGradeScaleMapping)?;
            if !(0..=MAX_NUMERIC_GRADE).contains(&grade) {
                return Err(CreditRegistrationErrorCode::NoGradeScaleMapping);
            }
            grade.to_string()
        }
    };
    Ok(MappedGrade {
        grade_scale_id: scale_id.to_string(),
        grade_id,
    })
}

/// Whether a frozen pair is one the registry will accept. Checked again before batching because a
/// pair it does not know is a request-level rejection: one bad row would fail twenty-four good ones.
pub fn is_known_grade(grade_scale_id: &str, grade_id: &str) -> bool {
    match grade_scale_family(grade_scale_id) {
        Some(GradeScaleFamily::PassFail) => grade_id == PASS_GRADE_ID || grade_id == FAIL_GRADE_ID,
        Some(GradeScaleFamily::Numeric) => grade_id
            .parse::<i32>()
            .is_ok_and(|grade| (0..=MAX_NUMERIC_GRADE).contains(&grade)),
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn source(passed: bool, grade: Option<i32>) -> GradeSource<'static> {
        GradeSource {
            passed,
            grade,
            configured_grade_scale_id: None,
            enrolment_grade_scale_id: None,
        }
    }

    #[test]
    fn a_completion_with_no_number_maps_to_the_pass_fail_scale() {
        assert_eq!(
            map_grade(source(true, None)),
            Ok(MappedGrade {
                grade_scale_id: PASS_FAIL_GRADE_SCALE_ID.to_string(),
                grade_id: PASS_GRADE_ID.to_string(),
            })
        );
    }

    #[test]
    fn a_graded_completion_maps_to_the_numeric_scale() {
        assert_eq!(
            map_grade(source(true, Some(4))),
            Ok(MappedGrade {
                grade_scale_id: NUMERIC_GRADE_SCALE_ID.to_string(),
                grade_id: "4".to_string(),
            })
        );
    }

    /// The order the algorithm resolves the scale in: the module's override, then what the registry
    /// told us the enrolment expects, then what we would have guessed.
    #[test]
    fn the_module_override_wins_over_the_enrolment_and_the_enrolment_over_the_guess() {
        let with_enrolment = GradeSource {
            enrolment_grade_scale_id: Some(PASS_FAIL_GRADE_SCALE_ID_ALT),
            ..source(true, Some(4))
        };
        assert_eq!(
            map_grade(with_enrolment).unwrap().grade_scale_id,
            PASS_FAIL_GRADE_SCALE_ID_ALT
        );
        assert_eq!(map_grade(with_enrolment).unwrap().grade_id, PASS_GRADE_ID);

        let overridden = GradeSource {
            configured_grade_scale_id: Some(NUMERIC_GRADE_SCALE_ID),
            ..with_enrolment
        };
        assert_eq!(
            map_grade(overridden).unwrap().grade_scale_id,
            NUMERIC_GRADE_SCALE_ID
        );
        assert_eq!(map_grade(overridden).unwrap().grade_id, "4");
    }

    /// A scale nobody recognises is a configuration problem, and it must surface as one before a
    /// batch is built rather than as a whole-batch rejection afterwards.
    #[test]
    fn an_unrecognised_scale_fails_before_anything_is_sent() {
        let source = GradeSource {
            configured_grade_scale_id: Some("sis-something-else"),
            ..source(true, Some(4))
        };
        assert_eq!(
            map_grade(source),
            Err(CreditRegistrationErrorCode::NoGradeScaleMapping)
        );
    }

    #[test]
    fn a_pass_fail_completion_cannot_be_pushed_into_a_numeric_scale() {
        let source = GradeSource {
            configured_grade_scale_id: Some(NUMERIC_GRADE_SCALE_ID),
            ..source(true, None)
        };
        assert_eq!(
            map_grade(source),
            Err(CreditRegistrationErrorCode::NoGradeScaleMapping)
        );
    }

    #[test]
    fn a_number_outside_the_scale_does_not_map() {
        assert_eq!(
            map_grade(source(true, Some(7))),
            Err(CreditRegistrationErrorCode::NoGradeScaleMapping)
        );
    }

    #[test]
    fn both_spellings_of_the_pass_fail_scale_are_the_same_scale() {
        assert!(same_grade_scale(
            PASS_FAIL_GRADE_SCALE_ID,
            PASS_FAIL_GRADE_SCALE_ID_ALT
        ));
        assert!(!same_grade_scale(
            PASS_FAIL_GRADE_SCALE_ID,
            NUMERIC_GRADE_SCALE_ID
        ));
    }

    #[test]
    fn only_pairs_the_registry_knows_pass_the_pre_flight() {
        assert!(is_known_grade(PASS_FAIL_GRADE_SCALE_ID, "1"));
        assert!(is_known_grade(PASS_FAIL_GRADE_SCALE_ID_ALT, "0"));
        assert!(is_known_grade(NUMERIC_GRADE_SCALE_ID, "5"));
        assert!(!is_known_grade(NUMERIC_GRADE_SCALE_ID, "6"));
        assert!(!is_known_grade(PASS_FAIL_GRADE_SCALE_ID, "3"));
        assert!(!is_known_grade("sis-something-else", "1"));
    }

    /// Everything `map_grade` produces has to survive the pre-flight, or a row could be frozen in a
    /// shape that only fails once it is inside a batch.
    #[test]
    fn everything_the_mapping_produces_passes_the_pre_flight() {
        let mut mapped = vec![map_grade(source(true, None)).unwrap()];
        for grade in 0..=MAX_NUMERIC_GRADE {
            mapped.push(map_grade(source(grade > 0, Some(grade))).unwrap());
        }
        for grade in mapped {
            assert!(
                is_known_grade(&grade.grade_scale_id, &grade.grade_id),
                "{grade:?}"
            );
        }
    }
}
