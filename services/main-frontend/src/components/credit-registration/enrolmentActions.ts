"use client"

import { type QueryClient, useQueryClient } from "@tanstack/react-query"

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

// The by-course-module cache is keyed per module and the enrolment is a course-wide fact, so the
// whole family is invalidated by query id rather than by the one key the caller happens to know.
const CREDIT_REGISTRATION_FOR_COURSE_MODULE_QUERY_ID = "getMyCreditRegistrationForCourseModule"

const invalidateRegistrationViews = async (
  queryClient: QueryClient,
  courseId: string,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationsQueryKey() }),
    queryClient.invalidateQueries({
      queryKey: getMyCreditRegistrationEnrolmentBannersQueryKey({ path: { course_id: courseId } }),
    }),
    queryClient.invalidateQueries({
      predicate: (query) =>
        (query.queryKey[0] as { _id?: string } | undefined)?._id ===
        CREDIT_REGISTRATION_FOR_COURSE_MODULE_QUERY_ID,
    }),
  ])
}

/** The one "I have enrolled, check again" action, shared by the status page and the in-course banner. */
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
