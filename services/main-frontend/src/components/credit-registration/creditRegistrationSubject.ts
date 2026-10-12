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

// Built here rather than picked from the generated options: `useQuery` cannot take a union of the
// two. The keys stay the generated ones, which invalidation matches on.
export const myRegistrationForSubjectOptions = (subject: CreditRegistrationSubject) =>
  queryOptions({
    queryKey:
      subject.kind === "course_module"
        ? getMyCreditRegistrationForCourseModuleQueryKey({
            path: { course_module_id: subject.courseModuleId },
          })
        : getMyCreditRegistrationForExternalCompletionQueryKey({
            path: { external_completion_id: subject.externalCompletionId },
          }),
    queryFn: async ({ signal }) =>
      subject.kind === "course_module"
        ? await getMyCreditRegistrationForCourseModule({
            path: { course_module_id: subject.courseModuleId },
            signal,
            throwOnError: true,
          })
        : await getMyCreditRegistrationForExternalCompletion({
            path: { external_completion_id: subject.externalCompletionId },
            signal,
            throwOnError: true,
          }),
  })

export const myEnrolmentRouteQueryKey = (subject: CreditRegistrationSubject) =>
  subject.kind === "course_module"
    ? getMyEnrolmentRouteQueryKey({ path: { course_module_id: subject.courseModuleId } })
    : getMyExternalCompletionEnrolmentRouteQueryKey({
        path: { external_completion_id: subject.externalCompletionId },
      })

export const myEnrolmentRouteOptions = (subject: CreditRegistrationSubject) =>
  queryOptions({
    queryKey: myEnrolmentRouteQueryKey(subject),
    queryFn: async ({ signal }) =>
      subject.kind === "course_module"
        ? await getMyEnrolmentRoute({
            path: { course_module_id: subject.courseModuleId },
            signal,
            throwOnError: true,
          })
        : await getMyExternalCompletionEnrolmentRoute({
            path: { external_completion_id: subject.externalCompletionId },
            signal,
            throwOnError: true,
          }),
  })

export const setEnrolmentRoute = async (
  subject: CreditRegistrationSubject,
  route: CreditRegistrationEnrolmentRoute,
): Promise<void> => {
  if (subject.kind === "course_module") {
    await setMyEnrolmentRoute({
      path: { course_module_id: subject.courseModuleId },
      body: { route },
    })
  } else {
    await setMyExternalCompletionEnrolmentRoute({
      path: { external_completion_id: subject.externalCompletionId },
      body: { route },
    })
  }
}

export const confirmEnrolment = async (subject: CreditRegistrationSubject): Promise<void> => {
  if (subject.kind === "course_module") {
    await confirmMyEnrolment({ path: { course_module_id: subject.courseModuleId } })
  } else {
    await confirmMyExternalCompletionEnrolment({
      path: { external_completion_id: subject.externalCompletionId },
    })
  }
}

export const withdrawEnrolmentConfirmation = async (
  subject: CreditRegistrationSubject,
): Promise<void> => {
  if (subject.kind === "course_module") {
    await withdrawMyEnrolmentConfirmation({ path: { course_module_id: subject.courseModuleId } })
  } else {
    await withdrawMyExternalCompletionEnrolmentConfirmation({
      path: { external_completion_id: subject.externalCompletionId },
    })
  }
}

export const recordEnrolmentPageVisit = async (
  subject: CreditRegistrationSubject,
): Promise<void> => {
  if (subject.kind === "course_module") {
    await recordMyEnrolmentPageVisit({ path: { course_module_id: subject.courseModuleId } })
  } else {
    await recordMyExternalCompletionEnrolmentPageVisit({
      path: { external_completion_id: subject.externalCompletionId },
    })
  }
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
