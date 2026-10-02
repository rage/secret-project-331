//! Catching typos in a student number a person types: today's University of Helsinki numbers are a
//! `0` and eight digits, the last a check digit.
//!
//! Only for typed input. A number from Sisu or Suotar is an opaque identifier and is taken as it
//! comes, since Sisu may change the format.

/// Weights of the first eight digits, left to right.
const CHECK_DIGIT_WEIGHTS: [u32; 8] = [3, 7, 1, 3, 7, 1, 3, 7];

/// Why a typed student number was rejected.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InvalidStudentNumber {
    /// Not a `0` followed by eight digits.
    Format,
    /// Well formed, but the check digit does not match: most likely a typo.
    CheckDigit,
}

impl InvalidStudentNumber {
    /// A sentence for the person who typed the number.
    pub fn message(self) -> &'static str {
        match self {
            Self::Format => "A student number is nine digits and starts with 0.",
            Self::CheckDigit => "The check digit does not match. Check the number for typos.",
        }
    }
}

/// `raw` with whitespace removed, if it passes as a typed student number. Mirrored by
/// `studentNumberProblem` in main-frontend.
pub fn parse_student_number(raw: &str) -> Result<String, InvalidStudentNumber> {
    let number: String = raw.chars().filter(|c| !c.is_whitespace()).collect();
    if number.len() != 9 || !number.starts_with('0') || !number.bytes().all(|b| b.is_ascii_digit())
    {
        return Err(InvalidStudentNumber::Format);
    }
    let sum: u32 = number
        .bytes()
        .zip(CHECK_DIGIT_WEIGHTS)
        .map(|(digit, weight)| u32::from(digit - b'0') * weight)
        .sum();
    if (10 - sum % 10) % 10 != u32::from(number.as_bytes()[8] - b'0') {
        return Err(InvalidStudentNumber::CheckDigit);
    }
    Ok(number)
}
