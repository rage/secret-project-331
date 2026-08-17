import { type QueryClient, queryOptions, useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"

import { getCourseCreditRegistrationsForUsers } from "@/generated/api/sdk.generated"
import type {
  CourseCreditRegistration,
  CreditRegistrationNotificationKind,
  EmailSendStatus,
  NotificationEmailStatus,
  StudentNumberVerificationMethod,
} from "@/generated/api/types.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

import { labelFrom, widenedLookup } from "./labelFrom"

// oxlint-disable-next-line i18next/no-literal-string
const QUERY_KEY_PREFIX = "course-credit-registrations/by-user-ids"

/** The server rejects a request body over 2 MB, and a caller may list every enrolled user. */
const USER_IDS_PER_REQUEST = 500

const fetchInBatches = async (
  courseId: string,
  userIds: string[],
): Promise<CourseCreditRegistration[]> => {
  const rows: CourseCreditRegistration[] = []
  for (let start = 0; start < userIds.length; start += USER_IDS_PER_REQUEST) {
    const batch = await getCourseCreditRegistrationsForUsers({
      path: { course_id: courseId },
      body: { user_ids: userIds.slice(start, start + USER_IDS_PER_REQUEST) },
    })
    rows.push(...batch)
  }
  return rows
}

/** Keyed `userId:moduleId`, newest attempt only. */
export const useTeacherCreditRegistrations = (courseId: string | null, userIds: string[]) =>
  useQuery(
    optionalGeneratedQueryOptions({
      value: courseId !== null && userIds.length > 0 ? { courseId, userIds } : null,
      isReady: (v): v is { courseId: string; userIds: string[] } => v !== null,
      build: ({ courseId: id, userIds: ids }) =>
        // oxlint-disable-next-line @tanstack/query/exhaustive-deps
        queryOptions({
          queryKey: [QUERY_KEY_PREFIX, id, ids],
          queryFn: () => fetchInBatches(id, ids),
          select: indexLiveRegistrations,
        }),
    }),
  )

/**
 * Marks every page's worth of these stale after an action that moved a row. Keyed by the user ids the
 * caller happened to be showing, so the family is invalidated by prefix rather than by one key.
 */
export const invalidateTeacherCreditRegistrations = (queryClient: QueryClient): Promise<void> =>
  queryClient.invalidateQueries({ queryKey: [QUERY_KEY_PREFIX] })

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

/** A support-established link rests on judgement, not on proof of mailbox control. */
export const isAdminEstablishedLink = (
  method: StudentNumberVerificationMethod | null | undefined,
): boolean => method === "admin_manual"

const LINKING_EMAIL_KEYS = {
  queued: "credit-registration-teacher-linking-email-queued",
  retrying: "credit-registration-teacher-linking-email-retrying",
  sent: "credit-registration-teacher-linking-email-sent",
  send_failed: "credit-registration-teacher-linking-email-send-failed",
} as const satisfies Record<EmailSendStatus, string>

/** Our own send status only: no wording here may imply a delivery. */
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

const NOTIFICATION_EMAIL_LABEL_KEYS = {
  action_needed: "label-credit-registration-action-needed-email",
  registered: "label-credit-registration-registered-email",
} as const satisfies Record<CreditRegistrationNotificationKind, string>

const NOTIFICATION_EMAIL_KEYS = {
  queued: "credit-registration-teacher-notification-email-queued",
  retrying: "credit-registration-teacher-notification-email-retrying",
  sent: "credit-registration-teacher-notification-email-sent",
  send_failed: "credit-registration-teacher-notification-email-send-failed",
} as const satisfies Record<EmailSendStatus, string>

export const notificationEmailLabel = (t: TFunction, kind: CreditRegistrationNotificationKind) =>
  labelFrom(t, NOTIFICATION_EMAIL_LABEL_KEYS, kind, NOTIFICATION_EMAIL_LABEL_KEYS.registered)

/** Our own send status only: no wording here may imply a delivery. */
export const notificationEmailSentence = (
  t: TFunction,
  notificationEmail: NotificationEmailStatus,
  locale: string,
): string =>
  labelFrom(
    t,
    NOTIFICATION_EMAIL_KEYS,
    notificationEmail.email_send_status,
    NOTIFICATION_EMAIL_KEYS.queued,
    {
      date: notificationEmail.sent_at
        ? new Date(notificationEmail.sent_at).toLocaleDateString(locale)
        : "",
    },
  )
