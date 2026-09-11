import {
  keepPreviousData,
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseCreditRegistrationActionsQueryKey,
  getCourseCreditRegistrationsOptions,
  getCourseCreditRegistrationSummaryQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { getCourseCreditRegistrationsForUsers } from "@/generated/api/sdk.generated"
import type {
  CourseCreditRegistration,
  CreditRegistrationErrorCode,
  CreditRegistrationNotificationKind,
  EmailSendStatus,
  NotificationEmailStatus,
  StudentFacingCreditRegistrationStatus,
  StudentNumberVerificationMethod,
  TeacherLinkingEmailStatus,
} from "@/generated/api/types.generated"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { humanReadableDate } from "@/shared-module/common/utils/time"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

import { CREDIT_REGISTRATION_NS } from "./constants"
import type { CreditRegistrationTFunction } from "./constants"
import { registrationErrorShortLabel } from "./creditRegistrationCopy"
import { labelFrom, widenedLookup } from "./labelFrom"
import type { FailureOwner } from "./registrationFailures"
import { failureOwner, retryableFailureCount } from "./registrationFailures"

const QUERY_KEY_PREFIX = "course-credit-registrations/by-user-ids"

/** The server rejects a request body over 2 MB, and a caller may list every enrolled user. */
const USER_IDS_PER_REQUEST = 500

/** Enough failures for the breakdown to be exact on any real course; past it, it says it is capped. */
const FAILED_ROWS_FETCHED = 500

const FAILED_STATUS: StudentFacingCreditRegistrationStatus[] = ["failed"]

/** A failed row the server sent no code for still needs grouping, and it is nobody's to retry. */
const UNCLASSIFIED_ERROR_CODE: CreditRegistrationErrorCode = "unknown"

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

/**
 * Whether this user may read the course's registrations at all.
 *
 * Not implied by the permission that opens a students/completions view: an assistant may hold that
 * one, and a registration carries the student's national study registry identity.
 */
export const useCanViewCreditRegistrations = (courseId: string | null): boolean =>
  useAuthorizeMultiple(
    courseId !== null
      ? [
          {
            action: { type: "view_and_manage_credit_registrations" },
            resource: { type: "course", id: courseId },
          },
        ]
      : [],
  ).data?.[0] === true

/**
 * Keyed `userId:moduleId`, newest attempt only.
 *
 * `isAuthorized` lets every consumer show the same loading/denied state instead of each guarding
 * the query itself. `isPending` is true only while there is no data at all for the current
 * `userIds` (first load); `keepPreviousData` means a later change of `userIds` keeps showing the
 * previous set's index rather than collapsing to empty, so a caller must not read a missing entry
 * as "no registration" without also checking this — see `isFetching` for the window where the
 * previous data may no longer match the ids on screen.
 */
export const useTeacherCreditRegistrations = (
  courseId: string | null,
  userIds: string[],
): {
  data: CreditRegistrationIndex
  isAuthorized: boolean
  isPending: boolean
  isFetching: boolean
} => {
  const isAuthorized = useCanViewCreditRegistrations(courseId)

  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: isAuthorized && courseId !== null && userIds.length > 0 ? { courseId, userIds } : null,
      isReady: (v): v is { courseId: string; userIds: string[] } => v !== null,
      build: ({ courseId: id, userIds: ids }) =>
        // oxlint-disable-next-line @tanstack/query/exhaustive-deps
        queryOptions({
          queryKey: [QUERY_KEY_PREFIX, id, ids],
          queryFn: () => fetchInBatches(id, ids),
          select: indexLiveRegistrations,
          placeholderData: keepPreviousData,
        }),
    }),
  )

  return {
    data: query.data ?? EMPTY_CREDIT_REGISTRATIONS,
    isAuthorized,
    isPending: query.isPending,
    isFetching: query.isFetching,
  }
}

/**
 * Marks every page's worth of these stale after an action that moved a row. Keyed by the user ids the
 * caller happened to be showing, so the family is invalidated by course id and prefix rather than by one key.
 */
export const invalidateTeacherCreditRegistrations = (
  queryClient: QueryClient,
  courseId: string,
): Promise<void> => queryClient.invalidateQueries({ queryKey: [QUERY_KEY_PREFIX, courseId] })

/** The single-row and bulk retry actions both move rows and so invalidate the same surfaces. */
export const useInvalidateAfterRetry = (courseId: string) => {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: getCourseCreditRegistrationSummaryQueryKey({ path: { course_id: courseId } }),
      }),
      queryClient.invalidateQueries({
        queryKey: getCourseCreditRegistrationActionsQueryKey({ path: { course_id: courseId } }),
      }),
      invalidateTeacherCreditRegistrations(queryClient, courseId),
    ])
}

/** One cause, whose problem it is, and how many of the course's failures have it. */
export interface CreditRegistrationFailureReason {
  errorCode: CreditRegistrationErrorCode
  label: string
  owner: FailureOwner
  count: number
}

/**
 * The failures of the course, or of one instance, grouped by cause and by who has to clear them.
 *
 * `retryableCount` is the only honest number for a retry button: the rest of the failures need a
 * course setting changed, a student to act, or support. There is no per-cause aggregate endpoint,
 * so the failed rows themselves are fetched and counted here; `isCapped` says the page was full
 * and every number is therefore a lower bound.
 *
 * `moduleId` narrows to one module. The endpoint has no module filter, so it is applied to the
 * rows that came back — exact unless `isCapped`.
 */
export const useCourseFailureReasons = (
  courseId: string,
  courseInstanceId: string | null,
  moduleId: string | null,
  enabled: boolean,
): {
  reasons: CreditRegistrationFailureReason[]
  retryableCount: number
  isCapped: boolean
} => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const query = useQuery({
    ...getCourseCreditRegistrationsOptions({
      path: { course_id: courseId },
      query: {
        page: 1,
        limit: FAILED_ROWS_FETCHED,
        status: FAILED_STATUS,
        ...includeIf(courseInstanceId, { course_instance_id: courseInstanceId }),
      },
    }),
    enabled,
  })

  return useMemo(() => {
    const fetched = query.data?.data ?? []
    const rows = moduleId ? fetched.filter((row) => row.course_module_id === moduleId) : fetched
    const counts = new Map<CreditRegistrationErrorCode, number>()
    for (const row of rows) {
      const errorCode = row.error_code ?? UNCLASSIFIED_ERROR_CODE
      counts.set(errorCode, (counts.get(errorCode) ?? 0) + 1)
    }
    return {
      reasons: [...counts.entries()]
        .map(([errorCode, count]) => ({
          errorCode,
          count,
          owner: failureOwner(errorCode),
          label:
            registrationErrorShortLabel(t, errorCode) ?? t("credit-registration-reason-unknown"),
        }))
        .toSorted((a, b) => b.count - a.count),
      retryableCount: retryableFailureCount(rows.map((row) => row.error_code)),
      isCapped: fetched.length >= FAILED_ROWS_FETCHED,
    }
  }, [query.data, moduleId, t])
}

export type CreditRegistrationIndex = Map<string, CourseCreditRegistration>

/** One shared instance: consumers feed the index straight into `useMemo` dependencies. */
const EMPTY_CREDIT_REGISTRATIONS: CreditRegistrationIndex = new Map()

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
  t: CreditRegistrationTFunction,
  method: StudentNumberVerificationMethod | null | undefined,
): string | null => {
  if (!method) {
    return null
  }
  const key = widenedLookup(VERIFICATION_METHOD_KEYS, method)
  return key ? t(key) : null
}

const LINKING_EMAIL_KEYS = {
  queued: "credit-registration-teacher-linking-email-queued",
  retrying: "credit-registration-teacher-linking-email-retrying",
  sent: "credit-registration-teacher-linking-email-sent",
  send_failed: "credit-registration-teacher-linking-email-send-failed",
} as const satisfies Record<EmailSendStatus, string>

/** Our own send status only: no wording here may imply a delivery. */
export const linkingEmailSentence = (
  t: CreditRegistrationTFunction,
  status: EmailSendStatus,
  sentAt: string | null | undefined,
  maskedAddress: string,
  locale: string,
): string =>
  labelFrom(t, LINKING_EMAIL_KEYS, status, LINKING_EMAIL_KEYS.queued, {
    address: maskedAddress,
    date: humanReadableDate(sentAt, locale) ?? "",
  })

const LINKING_EMAIL_SHORT_KEYS = {
  queued: "credit-registration-linking-email-short-queued",
  retrying: "credit-registration-linking-email-short-retrying",
  sent: "credit-registration-linking-email-short-sent",
  send_failed: "credit-registration-linking-email-short-send-failed",
} as const satisfies Record<EmailSendStatus, string>

/**
 * Where the student's confirmation link got to, in the few words a roster cell has room for.
 *
 * The reason line under a "No student number" pill: the teacher's question there is whether the
 * student was ever asked, not why a registration failed. Null when nothing has been sent yet.
 * Use `linkingEmailSentence` wherever there is room for the whole sentence.
 */
export const linkingEmailShortLabel = (
  t: CreditRegistrationTFunction,
  linkingEmail: TeacherLinkingEmailStatus | null | undefined,
  locale: string,
): string | null =>
  linkingEmail
    ? labelFrom(
        t,
        LINKING_EMAIL_SHORT_KEYS,
        linkingEmail.email_send_status,
        LINKING_EMAIL_SHORT_KEYS.queued,
        {
          date: humanReadableDate(linkingEmail.sent_at, locale) ?? "",
        },
      )
    : null

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

export const notificationEmailLabel = (
  t: CreditRegistrationTFunction,
  kind: CreditRegistrationNotificationKind,
) => labelFrom(t, NOTIFICATION_EMAIL_LABEL_KEYS, kind, NOTIFICATION_EMAIL_LABEL_KEYS.registered)

/** Our own send status only: no wording here may imply a delivery. */
export const notificationEmailSentence = (
  t: CreditRegistrationTFunction,
  notificationEmail: NotificationEmailStatus,
  locale: string,
): string =>
  labelFrom(
    t,
    NOTIFICATION_EMAIL_KEYS,
    notificationEmail.email_send_status,
    NOTIFICATION_EMAIL_KEYS.queued,
    {
      date: humanReadableDate(notificationEmail.sent_at, locale) ?? "",
    },
  )
