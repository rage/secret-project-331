import { queryOptions } from "@tanstack/react-query"

import {
  getMyCreditRegistrationForCourseModuleQueryKey,
  getMyCreditRegistrationForExternalCompletionQueryKey,
  getMyEnrolmentRouteQueryKey,
  getMyExternalCompletionEnrolmentRouteQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  confirmMyEnrolment,
  confirmMyExternalCompletionEnrolment,
  getMyCreditRegistrationForCourseModule,
  getMyCreditRegistrationForExternalCompletion,
  getMyEnrolmentRoute,
  getMyExternalCompletionEnrolmentRoute,
  recordMyEnrolmentPageVisit,
  recordMyExternalCompletionEnrolmentPageVisit,
  setMyEnrolmentRoute,
  setMyExternalCompletionEnrolmentRoute,
  withdrawMyEnrolmentConfirmation,
  withdrawMyExternalCompletionEnrolmentConfirmation,
} from "@/generated/api/sdk.generated"
import type {
  CreditRegistrationEnrolmentRoute,
  MyCreditRegistration,
} from "@/generated/api/types.generated"
import {
  completionRegistrationRoute,
  moocfiCompletionRegistrationRoute,
} from "@/shared-module/common/utils/routes"

/**
 * The completion a student status view is about: a course module's, or a mooc.fi one. Picks the
 * endpoint family every per-completion request goes to.
 */
export type CreditRegistrationSubject =
  | { kind: "course_module"; courseModuleId: string }
  | { kind: "mooc_fi"; externalCompletionId: string }

export const courseModuleSubject = (courseModuleId: string): CreditRegistrationSubject => ({
  kind: "course_module",
  courseModuleId,
})

export const moocfiSubject = (externalCompletionId: string): CreditRegistrationSubject => ({
  kind: "mooc_fi",
  externalCompletionId,
})

/** Every per-completion request, for the endpoint family `subject` belongs to. */
const endpointsFor = (subject: CreditRegistrationSubject) => {
  if (subject.kind === "course_module") {
    const path = { course_module_id: subject.courseModuleId }
    return {
      registrationQueryKey: getMyCreditRegistrationForCourseModuleQueryKey({ path }),
      getRegistration: (signal: AbortSignal) =>
        getMyCreditRegistrationForCourseModule({ path, signal, throwOnError: true }),
      enrolmentRouteQueryKey: getMyEnrolmentRouteQueryKey({ path }),
      getEnrolmentRoute: (signal: AbortSignal) =>
        getMyEnrolmentRoute({ path, signal, throwOnError: true }),
      setEnrolmentRoute: (route: CreditRegistrationEnrolmentRoute) =>
        setMyEnrolmentRoute({ path, body: { route } }),
      confirmEnrolment: () => confirmMyEnrolment({ path }),
      withdrawEnrolmentConfirmation: () => withdrawMyEnrolmentConfirmation({ path }),
      recordEnrolmentPageVisit: () => recordMyEnrolmentPageVisit({ path }),
    }
  }
  const path = { external_completion_id: subject.externalCompletionId }
  return {
    registrationQueryKey: getMyCreditRegistrationForExternalCompletionQueryKey({ path }),
    getRegistration: (signal: AbortSignal) =>
      getMyCreditRegistrationForExternalCompletion({ path, signal, throwOnError: true }),
    enrolmentRouteQueryKey: getMyExternalCompletionEnrolmentRouteQueryKey({ path }),
    getEnrolmentRoute: (signal: AbortSignal) =>
      getMyExternalCompletionEnrolmentRoute({ path, signal, throwOnError: true }),
    setEnrolmentRoute: (route: CreditRegistrationEnrolmentRoute) =>
      setMyExternalCompletionEnrolmentRoute({ path, body: { route } }),
    confirmEnrolment: () => confirmMyExternalCompletionEnrolment({ path }),
    withdrawEnrolmentConfirmation: () =>
      withdrawMyExternalCompletionEnrolmentConfirmation({ path }),
    recordEnrolmentPageVisit: () => recordMyExternalCompletionEnrolmentPageVisit({ path }),
  }
}

// Built here rather than picked from the generated options: `useQuery` cannot take a union of the
// two. The keys stay the generated ones, which invalidation matches on.
export const myRegistrationForSubjectOptions = (subject: CreditRegistrationSubject) => {
  const endpoints = endpointsFor(subject)
  return queryOptions({
    queryKey: endpoints.registrationQueryKey,
    queryFn: async ({ signal }) => await endpoints.getRegistration(signal),
  })
}

export const myEnrolmentRouteQueryKey = (subject: CreditRegistrationSubject) =>
  endpointsFor(subject).enrolmentRouteQueryKey

export const myEnrolmentRouteOptions = (subject: CreditRegistrationSubject) => {
  const endpoints = endpointsFor(subject)
  return queryOptions({
    queryKey: endpoints.enrolmentRouteQueryKey,
    queryFn: async ({ signal }) => await endpoints.getEnrolmentRoute(signal),
  })
}

export const setEnrolmentRoute = async (
  subject: CreditRegistrationSubject,
  route: CreditRegistrationEnrolmentRoute,
): Promise<void> => {
  await endpointsFor(subject).setEnrolmentRoute(route)
}

export const confirmEnrolment = async (subject: CreditRegistrationSubject): Promise<void> => {
  await endpointsFor(subject).confirmEnrolment()
}

export const withdrawEnrolmentConfirmation = async (
  subject: CreditRegistrationSubject,
): Promise<void> => {
  await endpointsFor(subject).withdrawEnrolmentConfirmation()
}

export const recordEnrolmentPageVisit = async (
  subject: CreditRegistrationSubject,
): Promise<void> => {
  await endpointsFor(subject).recordEnrolmentPageVisit()
}

/** The page the student follows `registration` on, or `null` for a row that names neither. */
export const registrationStatusPageRoute = (registration: MyCreditRegistration): string | null => {
  if (registration.course_module_id) {
    return completionRegistrationRoute(registration.course_module_id)
  }
  if (registration.moocfi_course_id) {
    return moocfiCompletionRegistrationRoute(registration.moocfi_course_id)
  }
  return null
}
