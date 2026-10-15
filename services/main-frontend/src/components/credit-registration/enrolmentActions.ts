"use client"

import { type QueryClient, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"

import {
  getMyCreditRegistrationEnrolmentBannersQueryKey,
  getMyCreditRegistrationsQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  dismissCreditRegistrationEnrolmentBanner,
  requestCreditRegistrationEnrolmentRecheck,
} from "@/generated/api/sdk.generated"
import type { MyCreditRegistration } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

import {
  type CreditRegistrationSubject,
  recordEnrolmentPageVisit,
} from "./creditRegistrationSubject"

// These caches are keyed per module or completion and the enrolment is a course-wide fact, so each
// family is invalidated by query id rather than by the one key the caller happens to know.
const PER_SUBJECT_REGISTRATION_QUERY_IDS: ReadonlySet<string> = new Set([
  "getMyCreditRegistrationForCourseModule",
  "getMyCreditRegistrationForExternalCompletion",
])

/**
 * Every student-facing view of a registration, for an action that moved the ledger row itself.
 * `courseId` is `null` for a mooc.fi registration, which has no in-course banner.
 */
export const invalidateRegistrationViews = async (
  queryClient: QueryClient,
  courseId: string | null | undefined,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationsQueryKey() }),
    courseId
      ? queryClient.invalidateQueries({
          queryKey: getMyCreditRegistrationEnrolmentBannersQueryKey({
            path: { course_id: courseId },
          }),
        })
      : null,
    queryClient.invalidateQueries({
      predicate: (query) => {
        const id = (query.queryKey[0] as { _id?: string } | undefined)?._id
        return id !== undefined && PER_SUBJECT_REGISTRATION_QUERY_IDS.has(id)
      },
    }),
  ])
}

/** The one enrolment recheck action, shared by the status page and the in-course banner. */
export const useRequestEnrolmentRecheck = () => {
  const queryClient = useQueryClient()
  return useToastMutation<void, unknown, MyCreditRegistration>(
    async (registration) => {
      await requestCreditRegistrationEnrolmentRecheck({ path: { id: registration.id } })
    },
    { notify: true, method: "POST" },
    {
      onSuccess: async (_result, registration) =>
        await invalidateRegistrationViews(queryClient, registration.course_id),
    },
  )
}

/**
 * Puts the in-course re-enrol banner away for one registration.
 *
 * Not a permanent opt-out: the backend clears the dismissal whenever the registration hits the
 * enrolment problem again, so the banner returns for a new problem.
 */
export const useDismissEnrolmentBanner = () => {
  const queryClient = useQueryClient()
  return useToastMutation<void, unknown, MyCreditRegistration>(
    async (registration) => {
      await dismissCreditRegistrationEnrolmentBanner({ path: { id: registration.id } })
    },
    { notify: false },
    {
      onSuccess: async (_result, registration) =>
        await invalidateRegistrationViews(queryClient, registration.course_id),
    },
  )
}

const useRecordEnrolmentPageVisit = () =>
  useToastMutation<void, unknown, CreditRegistrationSubject>(recordEnrolmentPageVisit, {
    notify: false,
  })

/**
 * Tells the backend the student is looking at the enrolment instructions, at most once per mount.
 *
 * The page polls its registration every 10 s; a `useRef` guard, not the polled data, is what keeps
 * a 10-minute visit from firing the request sixty times. Silent on failure: this is a scheduling
 * nudge, not something the student needs to know about.
 */
export const useRecordEnrolmentPageVisitOnce = (
  subject: CreditRegistrationSubject,
  shouldRecord: boolean,
): void => {
  const { mutate: recordVisit } = useRecordEnrolmentPageVisit()
  const hasRecordedRef = useRef(false)
  useEffect(() => {
    if (shouldRecord && !hasRecordedRef.current) {
      hasRecordedRef.current = true
      recordVisit(subject)
    }
  }, [shouldRecord, subject, recordVisit])
}
