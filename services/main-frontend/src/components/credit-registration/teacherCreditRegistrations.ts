import { queryOptions, useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"

import { getCourseCreditRegistrationsForUsers } from "@/generated/api/sdk.generated"
import type {
  CourseCreditRegistration,
  EmailSendStatus,
  StudentNumberVerificationMethod,
} from "@/generated/api/types.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

import { labelFrom, widenedLookup } from "./labelFrom"

// oxlint-disable-next-line i18next/no-literal-string
const QUERY_KEY_PREFIX = "course-credit-registrations/by-user-ids"

/**
 * The live credit registrations of the listed students, keyed `userId:moduleId`.
 *
 * Superseded attempts are dropped: a table cell answers "where does this module's registration
 * stand", and that is the newest attempt.
 */
export const useTeacherCreditRegistrations = (courseId: string | null, userIds: string[]) =>
  useQuery(
    optionalGeneratedQueryOptions({
      value: courseId !== null && userIds.length > 0 ? { courseId, userIds } : null,
      isReady: (v): v is { courseId: string; userIds: string[] } => v !== null,
      build: ({ courseId: id, userIds: ids }) =>
        // oxlint-disable-next-line @tanstack/query/exhaustive-deps
        queryOptions({
          queryKey: [QUERY_KEY_PREFIX, id, ids],
          queryFn: () =>
            getCourseCreditRegistrationsForUsers({
              path: { course_id: id },
              body: { user_ids: ids },
            }),
          select: indexLiveRegistrations,
        }),
    }),
  )

export type CreditRegistrationIndex = Map<string, CourseCreditRegistration>

export const creditRegistrationKey = (userId: string, moduleId: string) => `${userId}:${moduleId}`

const indexLiveRegistrations = (rows: CourseCreditRegistration[]): CreditRegistrationIndex => {
  const index: CreditRegistrationIndex = new Map()
  for (const row of rows) {
    if (row.superseded) {
      continue
    }
    index.set(creditRegistrationKey(row.user_id, row.course_module_id), row)
  }
  return index
}

const VERIFICATION_METHOD_KEYS = {
  emailed_link: "credit-registration-student-number-via-emailed-link",
  email_match_fast_track: "credit-registration-student-number-via-email-match",
  admin_manual: "credit-registration-student-number-via-admin-manual",
} as const satisfies Record<StudentNumberVerificationMethod, string>

/**
 * How the link was established. Rendered next to the number because a support-established link rests
 * on a judgement rather than on proof that the student controls the mailbox.
 */
export const studentNumberVerificationLabel = (
  t: TFunction,
  method: StudentNumberVerificationMethod | null | undefined,
): string | null => {
  if (!method) {
    return null
  }
  const key = widenedLookup(VERIFICATION_METHOD_KEYS, method)
  return key ? t(key) : null
}

/** Whether the link came from support rather than from the student proving mailbox control. */
export const isAdminEstablishedLink = (
  method: StudentNumberVerificationMethod | null | undefined,
): boolean => method === "admin_manual"

const LINKING_EMAIL_KEYS = {
  queued: "credit-registration-teacher-linking-email-queued",
  retrying: "credit-registration-teacher-linking-email-retrying",
  sent: "credit-registration-teacher-linking-email-sent",
  send_failed: "credit-registration-teacher-linking-email-send-failed",
} as const satisfies Record<EmailSendStatus, string>

/**
 * What we can honestly say about the linking mail. Our send status only, never a delivery, and the
 * address only as its domain.
 */
export const linkingEmailSentence = (
  t: TFunction,
  status: EmailSendStatus,
  sentAt: string | null | undefined,
  maskedAddress: string,
  locale: string,
): string =>
  labelFrom(t, LINKING_EMAIL_KEYS, status, LINKING_EMAIL_KEYS.queued, {
    address: maskedAddress,
    date: sentAt ? new Date(sentAt).toLocaleDateString(locale) : "",
  })
