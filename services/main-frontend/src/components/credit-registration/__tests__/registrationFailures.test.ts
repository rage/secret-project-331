import type { CreditRegistrationErrorCode } from "@/generated/api/types.generated"

import {
  canRetryFailure,
  failureActions,
  failureOwner,
  retryableFailureCount,
} from "../registrationFailures"

const ALL_ERROR_CODES: CreditRegistrationErrorCode[] = [
  "person_not_found",
  "course_code_not_found",
  "enrolment_not_found",
  "enrolment_not_accepted",
  "invalid_grade_for_grade_scale",
  "course_not_allowed",
  "invalid_credits",
  "study_right_not_valid",
  "acceptor_not_found",
  "sisu_validation_failed",
  "sisu_timeout",
  "sisu_temporarily_unavailable",
  "misregistered",
  "unauthorized",
  "malformed_request",
  "transport_error",
  "unexpected_response",
  "no_grade_scale_mapping",
  "missing_uh_course_code",
  "missing_ects_credits",
  "retry_window_expired",
  "unknown",
]

describe("failure ownership", () => {
  test("classifies the codes the teacher fixes as course setup", () => {
    const courseSetup = ALL_ERROR_CODES.filter((code) => failureOwner(code) === "course_setup")
    expect(courseSetup.toSorted()).toEqual([
      "course_code_not_found",
      "invalid_credits",
      "invalid_grade_for_grade_scale",
      "missing_ects_credits",
      "missing_uh_course_code",
      "no_grade_scale_mapping",
    ])
  })

  test("only the transient codes can be retried", () => {
    const retryable = ALL_ERROR_CODES.filter((code) => canRetryFailure(code))
    expect(retryable.toSorted()).toEqual([
      "retry_window_expired",
      "sisu_temporarily_unavailable",
      "transport_error",
      "unexpected_response",
    ])
  })

  test("a timeout is not retryable, because nobody knows whether it landed", () => {
    expect(canRetryFailure("sisu_timeout")).toBe(false)
    expect(failureActions("sisu_timeout", "admin").primary).toBe("recheck_registry")
  })

  test("an unknown or missing code is support's, never retryable", () => {
    expect(failureOwner(null)).toBe("support")
    expect(canRetryFailure(null)).toBe(false)
    expect(canRetryFailure("unknown")).toBe(false)
  })

  test("counts only the failures a retry could clear", () => {
    expect(
      retryableFailureCount(["transport_error", "person_not_found", "sisu_timeout", null]),
    ).toBe(1)
  })
})

describe("failure actions", () => {
  test("never offers a retry outside the transient codes", () => {
    for (const code of ALL_ERROR_CODES) {
      for (const audience of ["student", "teacher", "admin"] as const) {
        const plan = failureActions(code, audience)
        const offersRetry = plan.primary === "retry" || plan.secondary.includes("retry")
        expect(offersRetry).toBe(canRetryFailure(code) && audience !== "student")
      }
    }
  })

  test("points a teacher at the module settings for a setup failure", () => {
    expect(failureActions("missing_uh_course_code", "teacher").primary).toBe(
      "fix_module_configuration",
    )
  })

  test("gives the student the lever and the teacher the message", () => {
    expect(failureActions("enrolment_not_found", "student").primary).toBe("enrol")
    expect(failureActions("enrolment_not_found", "teacher").primary).toBe("email_student")
    expect(failureActions("person_not_found", "student").primary).toBe("check_own_student_number")
    expect(failureActions("person_not_found", "admin").primary).toBe("link_student_number_by_hand")
  })

  test("offers no false hope on a support-owned failure", () => {
    expect(failureActions("misregistered", "teacher").primary).toBeNull()
    expect(failureActions("misregistered", "admin")).toEqual({
      owner: "support",
      remedy: "support",
      primary: null,
      secondary: [],
    })
  })

  test("never sends an administrator to support, because they are support", () => {
    for (const code of ALL_ERROR_CODES) {
      const plan = failureActions(code, "admin")
      expect(plan.secondary).not.toContain("contact_support")
      expect(plan.primary).not.toBe("contact_support")
    }
  })
})
