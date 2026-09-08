import type { MyCreditRegistration } from "@/generated/api/types.generated"
import { omitUndefined } from "@/shared-module/common/utils/nullability"

import type { CreditRegistrationTFunction } from "./constants"
import { registrationErrorShortLabel, registrationStatusLabel } from "./creditRegistrationCopy"
import { translateKey } from "./labelFrom"

/** What one prefilled support mail is made of; feed it straight to `SupportMailLink`. */
export interface SupportMailContents {
  subject: string
  bodyLines: string[]
  reference?: string
}

/**
 * A support mail about one registration, carrying what support needs to find the row.
 *
 * The registration id doubles as the reference, so a mail client that drops the prefilled body
 * still leaves the student something to quote.
 */
export const registrationSupportMail = (
  t: CreditRegistrationTFunction,
  registration: MyCreditRegistration,
): SupportMailContents => {
  const part = registration.course_module_name
  const reason = registrationErrorShortLabel(t, registration.error_code)
  return {
    subject: t("support-mail-subject-credit-registration", { course: registration.course_name }),
    bodyLines: [
      t("support-mail-line-course", { course: registration.course_name }),
      ...(part ? [t("support-mail-line-course-part", { part })] : []),
      t("support-mail-line-status", {
        status: registrationStatusLabel(t, registration.student_facing_status),
      }),
      ...(reason ? [t("support-mail-line-reason", { reason })] : []),
      ...(registration.student_number
        ? [t("support-mail-line-student-number", { studentNumber: registration.student_number })]
        : []),
      t("support-mail-line-reference", { reference: registration.id }),
    ],
    reference: registration.id,
  }
}

/** What a confirmation link can leave a student stuck on, and so what the mail has to ask for. */
export type StudentNumberLinkProblem =
  | "need_a_new_link"
  | "used_by_someone_else"
  | "linked_to_another_account"

export const NEED_A_NEW_LINK: StudentNumberLinkProblem = "need_a_new_link"

const LINK_PROBLEM_KEYS = {
  need_a_new_link: "support-mail-line-need-a-new-confirmation-link",
  used_by_someone_else: "support-mail-line-link-used-by-someone-else",
  linked_to_another_account: "support-mail-line-number-linked-to-another-account",
} as const satisfies Record<StudentNumberLinkProblem, string>

/** A support mail about a confirmation link the student never received or can no longer use. */
export const studentNumberLinkSupportMail = (
  t: CreditRegistrationTFunction,
  problem: StudentNumberLinkProblem,
  studentNumber?: string | null,
): SupportMailContents => ({
  subject: t("support-mail-subject-student-number-link"),
  bodyLines: [
    translateKey(t, LINK_PROBLEM_KEYS[problem]),
    ...(studentNumber ? [t("support-mail-line-student-number", { studentNumber })] : []),
  ],
  ...omitUndefined({ reference: studentNumber ?? undefined }),
})
