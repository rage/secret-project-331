import { queryOptions } from "@tanstack/react-query"

import {
  getMyCreditRegistrationForCourseModuleQueryKey,
  getMyCreditRegistrationForExternalCompletionQueryKey,
  getMyEnrolmentRouteQueryKey,
  getMyExternalCompletionEnrolmentRouteQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  chooseMyCertificate,
  chooseMyExternalCompletionCertificate,
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
  withdrawMyCertificateChoice,
  withdrawMyEnrolmentConfirmation,
  withdrawMyExternalCompletionCertificateChoice,
  withdrawMyExternalCompletionEnrolmentConfirmation,
} from "@/generated/api/sdk.generated"
import type {
  MyCreditRegistration,
  SetEnrolmentRoutePayload,
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

/** The id of the module or completion `subject` names; the two id spaces do not overlap. */
export const subjectId = (subject: CreditRegistrationSubject): string =>
  subject.kind === "course_module" ? subject.courseModuleId : subject.externalCompletionId

/**
 * A certificate the student can take instead of registering, which is what turns on the Open
 * University detour. Only a course module offers one.
 */
export interface CertificateOffer {
  courseModuleId: string
  certificateConfigurationId: string
  /** The student's saved reason for needing credits anyway, asked at the end of the detour. */
  creditJustification: string | null | undefined
}

/** The module's certificate offer, or `null` when it has no certificate to offer. */
export const moduleCertificateOffer = (
  courseModuleId: string,
  certificateConfigurationId: string | null | undefined,
  creditJustification: string | null | undefined,
): CertificateOffer | null =>
  certificateConfigurationId
    ? { courseModuleId, certificateConfigurationId, creditJustification }
    : null

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
      setEnrolmentRoute: (answers: SetEnrolmentRoutePayload) =>
        setMyEnrolmentRoute({ path, body: answers }),
      confirmEnrolment: () => confirmMyEnrolment({ path }),
      withdrawEnrolmentConfirmation: () => withdrawMyEnrolmentConfirmation({ path }),
      chooseCertificate: () => chooseMyCertificate({ path }),
      withdrawCertificateChoice: () => withdrawMyCertificateChoice({ path }),
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
    setEnrolmentRoute: (answers: SetEnrolmentRoutePayload) =>
      setMyExternalCompletionEnrolmentRoute({ path, body: answers }),
    confirmEnrolment: () => confirmMyExternalCompletionEnrolment({ path }),
    withdrawEnrolmentConfirmation: () =>
      withdrawMyExternalCompletionEnrolmentConfirmation({ path }),
    chooseCertificate: () => chooseMyExternalCompletionCertificate({ path }),
    withdrawCertificateChoice: () => withdrawMyExternalCompletionCertificateChoice({ path }),
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
  answers: SetEnrolmentRoutePayload,
): Promise<void> => {
  await endpointsFor(subject).setEnrolmentRoute(answers)
}

export const confirmEnrolment = async (subject: CreditRegistrationSubject): Promise<void> => {
  await endpointsFor(subject).confirmEnrolment()
}

export const withdrawEnrolmentConfirmation = async (
  subject: CreditRegistrationSubject,
): Promise<void> => {
  await endpointsFor(subject).withdrawEnrolmentConfirmation()
}

export const chooseCertificate = async (subject: CreditRegistrationSubject): Promise<void> => {
  await endpointsFor(subject).chooseCertificate()
}

export const withdrawCertificateChoice = async (
  subject: CreditRegistrationSubject,
): Promise<void> => {
  await endpointsFor(subject).withdrawCertificateChoice()
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
