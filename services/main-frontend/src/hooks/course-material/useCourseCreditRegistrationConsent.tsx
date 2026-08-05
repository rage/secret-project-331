"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useContext } from "react"

import {
  getMyCourseCreditRegistrationConsentOptions,
  getMyCourseCreditRegistrationConsentQueryKey,
  getMyCreditRegistrationConsentsQueryKey,
  getMyCreditRegistrationsQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { setMyCourseCreditRegistrationConsent } from "@/generated/api/sdk.generated"
import type { SetMyCourseCreditRegistrationConsentResult } from "@/generated/api/types.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseCourseCreditRegistrationConsentOptions {
  enabled?: boolean
}

const CONSENT_STALE_TIME_MS = 5 * 60 * 1000

/** Gates a course-start dialog step, so it must settle before that decision is made. */
const useCourseCreditRegistrationConsent = (
  courseId: string | null,
  options: UseCourseCreditRegistrationConsentOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: loginState.signedIn === true && enabled,
      isReady: (id): id is string => Boolean(id),
      build: (id) => ({
        ...getMyCourseCreditRegistrationConsentOptions({
          path: {
            course_id: id,
          },
        }),
        // Read on every page load, and only the dialog's own answer changes it.
        staleTime: CONSENT_STALE_TIME_MS,
      }),
    }),
  )
  return query
}

export default useCourseCreditRegistrationConsent

interface SetCreditRegistrationConsentVariables {
  courseId: string
  consentGiven: boolean
}

// The by-course-module registration cache is keyed per module; a course-wide consent change
// doesn't tell us which modules are affected, so this invalidates the whole family by query id.
const CREDIT_REGISTRATION_FOR_COURSE_MODULE_QUERY_ID = "getMyCreditRegistrationForCourseModule"

/** Consent is read from three surfaces (course-module status, consents list, course dialog), kept in sync here. */
export const useSetCreditRegistrationConsent = (options: { notify?: boolean } = {}) => {
  const { notify = true } = options
  const queryClient = useQueryClient()
  return useToastMutation<
    SetMyCourseCreditRegistrationConsentResult,
    unknown,
    SetCreditRegistrationConsentVariables
  >(
    async ({ courseId, consentGiven }) =>
      await setMyCourseCreditRegistrationConsent({
        path: { course_id: courseId },
        body: { consent_given: consentGiven },
      }),
    notify ? { notify: true, method: "PUT" } : { notify: false },
    {
      onSuccess: async (_result, { courseId }) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationConsentsQueryKey() }),
          queryClient.invalidateQueries({
            queryKey: getMyCourseCreditRegistrationConsentQueryKey({
              path: { course_id: courseId },
            }),
          }),
          queryClient.invalidateQueries({
            predicate: (query) =>
              (query.queryKey[0] as { _id?: string } | undefined)?._id ===
              CREDIT_REGISTRATION_FOR_COURSE_MODULE_QUERY_ID,
          }),
        ])
      },
    },
  )
}
