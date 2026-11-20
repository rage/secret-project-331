//! Reading mooc.fi's completion grades, which are free text there.

use crate::external_credit_targets::ExternalGrading;

/// A mooc.fi grade in the form the ledger reads grades in. Both `None` means the grade was not
/// recognised.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ParsedMoocfiGrade {
    pub passed: Option<bool>,
    /// 0 for a fail, 1–5 for a numeric pass, `None` for a pass/fail pass.
    pub grade: Option<i32>,
}

const PASS_WORDS: [&str; 6] = ["pass", "passed", "hyväksytty", "hyv", "godkänd", "accepted"];
const FAIL_WORDS: [&str; 5] = ["fail", "failed", "hylätty", "hyl", "underkänd"];

/// Parses `raw_grade` as mooc.fi stores it. A missing grade reads per the target's `grading`:
/// automatic completions carry none, which is a pass only on a pass/fail target.
pub fn parse_moocfi_grade(raw_grade: Option<&str>, grading: ExternalGrading) -> ParsedMoocfiGrade {
    const UNRECOGNISED: ParsedMoocfiGrade = ParsedMoocfiGrade {
        passed: None,
        grade: None,
    };
    const PASS: ParsedMoocfiGrade = ParsedMoocfiGrade {
        passed: Some(true),
        grade: None,
    };
    const FAIL: ParsedMoocfiGrade = ParsedMoocfiGrade {
        passed: Some(false),
        grade: Some(0),
    };

    let normalised = raw_grade.unwrap_or_default().trim().to_lowercase();
    if normalised.is_empty() {
        return match grading {
            ExternalGrading::PassFail => PASS,
            ExternalGrading::Numeric => UNRECOGNISED,
        };
    }
    if PASS_WORDS.contains(&normalised.as_str()) {
        return PASS;
    }
    if FAIL_WORDS.contains(&normalised.as_str()) {
        return FAIL;
    }
    match normalised.replace(',', ".").parse::<f64>() {
        Ok(0.0) => FAIL,
        Ok(number) if number.fract() == 0.0 && (1.0..=5.0).contains(&number) => ParsedMoocfiGrade {
            passed: Some(true),
            grade: Some(number as i32),
        },
        _ => UNRECOGNISED,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(raw_grade: Option<&str>, grading: ExternalGrading) -> (Option<bool>, Option<i32>) {
        let parsed = parse_moocfi_grade(raw_grade, grading);
        (parsed.passed, parsed.grade)
    }

    #[test]
    fn parses_the_grades_mooc_fi_stores() {
        use ExternalGrading::{Numeric, PassFail};
        assert_eq!(parse(None, PassFail), (Some(true), None));
        assert_eq!(parse(Some("  "), Numeric), (None, None));
        assert_eq!(parse(Some(" Hyväksytty "), Numeric), (Some(true), None));
        assert_eq!(parse(Some("FAILED"), PassFail), (Some(false), Some(0)));
        assert_eq!(parse(Some("0"), Numeric), (Some(false), Some(0)));
        assert_eq!(parse(Some("4,0"), Numeric), (Some(true), Some(4)));
        assert_eq!(parse(Some("5.0"), PassFail), (Some(true), Some(5)));
        assert_eq!(parse(Some("4.5"), Numeric), (None, None));
        assert_eq!(parse(Some("6"), Numeric), (None, None));
        assert_eq!(parse(Some("excellent"), PassFail), (None, None));
    }
}
