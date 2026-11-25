import type { QueryClient } from "@tanstack/react-query"

import {
  getCourseModuleUserCompletionQueryKey,
  getMyEnrolmentRouteQueryKey,
  getMyMoocfiCompletionRegistrationQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  chooseMyCertificate,
  chooseMyMoocfiCompletionCertificate,
  confirmMyEnrolment,
  confirmMyMoocfiCompletionEnrolment,
  createMyMoocfiHandoff,
  recordMyEnrolmentPageVisit,
  recordMyMoocfiCompletionEnrolmentPageVisit,
  setMyCreditJustification,
  setMyEnrolmentRoute,
  setMyMoocfiCompletionCreditJustification,
  setMyMoocfiCompletionEnrolmentRoute,
  withdrawMyCertificateChoice,
  withdrawMyEnrolmentConfirmation,
  withdrawMyMoocfiCompletionCertificateChoice,
  withdrawMyMoocfiCompletionEnrolmentConfirmation,
} from "@/generated/api/sdk.generated"
import type {
  MoocfiCreditRegistrations,
  MyCreditRegistration,
  MyEnrolmentRoute,
  MyMoocfiCompletionRegistration,
  SetEnrolmentRoutePayload,
} from "@/generated/api/types.generated"
import {
  completionRegistrationRoute,
  moocfiCompletionRegistrationRoute,
} from "@/shared-module/common/utils/routes"

/**
 * The completion a student status view is about: a course module's, or a mooc.fi one under every
 * course code it registers under. Picks the endpoint family every per-completion request goes to.
 */
export type CreditRegistrationSubject =
  | { kind: "course_module"; courseModuleId: string }
  | { kind: "mooc_fi"; moocfiCompletionId: string }

export const courseModuleSubject = (courseModuleId: string): CreditRegistrationSubject => ({
  kind: "course_module",
  courseModuleId,
})

export const moocfiSubject = (moocfiCompletionId: string): CreditRegistrationSubject => ({
  kind: "mooc_fi",
  moocfiCompletionId,
})

/** The id of the module or mooc.fi completion `subject` names; the two id spaces do not overlap. */
export const subjectId = (subject: CreditRegistrationSubject): string =>
  subject.kind === "course_module" ? subject.courseModuleId : subject.moocfiCompletionId

/**
 * A certificate the student can take instead of registering, which is what turns on the Open
 * University detour: a module's, generated here, or a mooc.fi course's, on mooc.fi.
 */
export type CertificateOffer = ModuleCertificateOffer | MoocfiCertificateOffer

export interface ModuleCertificateOffer {
  kind: "course_module"
  courseModuleId: string
  certificateConfigurationId: string
  /** The student's saved reason for needing credits anyway, asked at the end of the detour. */
  creditJustification: string | null | undefined
}

export interface MoocfiCertificateOffer {
  kind: "mooc_fi"
  moocfiCompletionId: string
  creditJustification: string | null | undefined
}

/** The module's certificate offer, or `null` when it has no certificate to offer. */
export const moduleCertificateOffer = (
  courseModuleId: string,
  certificateConfigurationId: string | null | undefined,
  creditJustification: string | null | undefined,
): ModuleCertificateOffer | null =>
  certificateConfigurationId
    ? { kind: "course_module", courseModuleId, certificateConfigurationId, creditJustification }
    : null

/** The mooc.fi completion's certificate offer, or `null` when mooc.fi says there is none. */
export const moocfiCertificateOffer = (
  moocfiCompletionId: string,
  offersCertificate: boolean,
  creditJustification: string | null | undefined,
): MoocfiCertificateOffer | null =>
  offersCertificate ? { kind: "mooc_fi", moocfiCompletionId, creditJustification } : null

/** The completion whose credit justification the offer's detour asks for. */
export const certificateOfferSubject = (certificate: CertificateOffer): CreditRegistrationSubject =>
  certificate.kind === "course_module"
    ? courseModuleSubject(certificate.courseModuleId)
    : moocfiSubject(certificate.moocfiCompletionId)

/** Every per-completion write, for the endpoint family `subject` belongs to. */
const writesFor = (subject: CreditRegistrationSubject) => {
  if (subject.kind === "course_module") {
    const path = { course_module_id: subject.courseModuleId }
    return {
      setEnrolmentRoute: (answers: SetEnrolmentRoutePayload) =>
        setMyEnrolmentRoute({ path, body: answers }),
      confirmEnrolment: () => confirmMyEnrolment({ path }),
      withdrawEnrolmentConfirmation: () => withdrawMyEnrolmentConfirmation({ path }),
      chooseCertificate: () => chooseMyCertificate({ path }),
      withdrawCertificateChoice: () => withdrawMyCertificateChoice({ path }),
      recordEnrolmentPageVisit: () => recordMyEnrolmentPageVisit({ path }),
      setCreditJustification: (justification: string) =>
        setMyCreditJustification({ path, body: { justification } }),
    }
  }
  const path = { moocfi_completion_id: subject.moocfiCompletionId }
  return {
    setEnrolmentRoute: (answers: SetEnrolmentRoutePayload) =>
      setMyMoocfiCompletionEnrolmentRoute({ path, body: answers }),
    confirmEnrolment: () => confirmMyMoocfiCompletionEnrolment({ path }),
    withdrawEnrolmentConfirmation: () => withdrawMyMoocfiCompletionEnrolmentConfirmation({ path }),
    chooseCertificate: () => chooseMyMoocfiCompletionCertificate({ path }),
    withdrawCertificateChoice: () => withdrawMyMoocfiCompletionCertificateChoice({ path }),
    recordEnrolmentPageVisit: () => recordMyMoocfiCompletionEnrolmentPageVisit({ path }),
    setCreditJustification: (justification: string) =>
      setMyMoocfiCompletionCreditJustification({ path, body: { justification } }),
  }
}

/**
 * The cached query `subject`'s enrolment answers are read from, and that query's data with
 * `answers` saved: the module's answers, or every mooc.fi code's that can still change.
 */
export const enrolmentAnswersCache = (subject: CreditRegistrationSubject) => {
  if (subject.kind === "course_module") {
    return {
      queryKey: getMyEnrolmentRouteQueryKey({
        path: { course_module_id: subject.courseModuleId },
      }),
      withAnswers: (cached: unknown, answers: SetEnrolmentRoutePayload): unknown => {
        const route = cached as MyEnrolmentRoute
        return { ...route, ...answers }
      },
    }
  }
  return {
    queryKey: getMyMoocfiCompletionRegistrationQueryKey({
      path: { moocfi_completion_id: subject.moocfiCompletionId },
    }),
    withAnswers: (cached: unknown, answers: SetEnrolmentRoutePayload): unknown => {
      const completion = cached as MyMoocfiCompletionRegistration
      return {
        ...completion,
        enrolment_route: { ...completion.enrolment_route, ...answers },
        codes: completion.codes.map((code) =>
          code.enrolment_route.can_change
            ? { ...code, enrolment_route: { ...code.enrolment_route, ...answers } }
            : code,
        ),
      }
    },
  }
}

export const setEnrolmentRoute = async (
  subject: CreditRegistrationSubject,
  answers: SetEnrolmentRoutePayload,
): Promise<void> => {
  await writesFor(subject).setEnrolmentRoute(answers)
}

export const confirmEnrolment = async (subject: CreditRegistrationSubject): Promise<void> => {
  await writesFor(subject).confirmEnrolment()
}

export const withdrawEnrolmentConfirmation = async (
  subject: CreditRegistrationSubject,
): Promise<void> => {
  await writesFor(subject).withdrawEnrolmentConfirmation()
}

export const chooseCertificate = async (subject: CreditRegistrationSubject): Promise<void> => {
  await writesFor(subject).chooseCertificate()
}

export const withdrawCertificateChoice = async (
  subject: CreditRegistrationSubject,
): Promise<void> => {
  await writesFor(subject).withdrawCertificateChoice()
}

export const recordEnrolmentPageVisit = async (
  subject: CreditRegistrationSubject,
): Promise<void> => {
  await writesFor(subject).recordEnrolmentPageVisit()
}

export const setCreditJustification = async (
  subject: CreditRegistrationSubject,
  justification: string,
): Promise<void> => {
  await writesFor(subject).setCreditJustification(justification)
}

/** Shows a just-saved justification wherever the page reads it back from. */
export const showSavedCreditJustification = async (
  queryClient: QueryClient,
  subject: CreditRegistrationSubject,
  justification: string,
): Promise<void> => {
  if (subject.kind === "course_module") {
    await queryClient.invalidateQueries({
      queryKey: getCourseModuleUserCompletionQueryKey({
        path: { course_module_id: subject.courseModuleId },
      }),
    })
    return
  }
  // Written into the cached page data: refetching it would read mooc.fi again, which is rate
  // limited.
  queryClient.setQueriesData<MoocfiCreditRegistrations>(
    { queryKey: [{ _id: "getMyMoocfiCreditRegistrations" }] },
    (registrations) =>
      registrations && {
        ...registrations,
        completions: registrations.completions.map((completion) =>
          completion.moocfi_completion_id === subject.moocfiCompletionId
            ? { ...completion, credit_justification: justification }
            : completion,
        ),
      },
  )
}

/**
 * Sends the browser to mooc.fi's certificate page, signed in as the completion's student. A full
 * navigation: the handoff URL is on another site and carries a single-use token.
 */
export const goToMoocfiCertificate = async (
  certificate: MoocfiCertificateOffer,
  uiLanguage: string,
): Promise<void> => {
  const { redirect_url } = await createMyMoocfiHandoff({
    path: { moocfi_completion_id: certificate.moocfiCompletionId },
    body: { destination: "certificate", ui_language: uiLanguage },
  })
  window.location.assign(redirect_url)
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
