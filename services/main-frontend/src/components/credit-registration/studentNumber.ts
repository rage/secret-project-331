import type { CreditRegistrationTFunction } from "./constants"

const CHECK_DIGIT_WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7] as const

/**
 * Why a typed student number is not one. Mirrors `parse_student_number` in headless-lms.
 *
 * Only for numbers a person types to verify a link: numbers from Sisu are opaque and may change
 * format, so nothing shown from our data is held to this.
 */
export type StudentNumberProblem = "format" | "check-digit"

/** What is wrong with a typed student number, if anything. Ignores whitespace, as the API does. */
export function studentNumberProblem(raw: string): StudentNumberProblem | null {
  const number = raw.replaceAll(/\s/g, "")
  if (!/^0\d{8}$/.test(number)) {
    return "format"
  }
  const sum = CHECK_DIGIT_WEIGHTS.reduce(
    (total, weight, index) => total + Number(number[index]) * weight,
    0,
  )
  return (10 - (sum % 10)) % 10 === Number(number[8]) ? null : "check-digit"
}

/** A react-hook-form `validate` rule; an empty field is left to `required`. */
export const validateStudentNumber =
  (t: CreditRegistrationTFunction) =>
  (value: string): true | string => {
    if (value.trim() === "") {
      return true
    }
    switch (studentNumberProblem(value)) {
      case "format":
        return t("credit-registration-student-number-invalid-format")
      case "check-digit":
        return t("credit-registration-student-number-invalid-check-digit")
      case null:
        return true
    }
  }
