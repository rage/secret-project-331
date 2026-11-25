"use client"

import { useQueryClient } from "@tanstack/react-query"

import type { MyEnrolmentRoute, SetEnrolmentRoutePayload } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

import {
  chooseCertificate as chooseCertificateFor,
  confirmEnrolment as confirmEnrolmentFor,
  type CreditRegistrationSubject,
  myEnrolmentRouteQueryKey,
  setEnrolmentRoute,
  subjectId,
  withdrawCertificateChoice as withdrawCertificateChoiceFor,
  withdrawEnrolmentConfirmation as withdrawEnrolmentConfirmationFor,
} from "../creditRegistrationSubject"
import { invalidateRegistrationViews } from "../enrolmentActions"

/** The answers the student gives on the questions page, as the server stores them. */
export type EnrolmentAnswers = SetEnrolmentRoutePayload

/** The stored answers as a save would send them back; `null` before the first answer. */
export const storedAnswersOf = (enrolmentRoute: MyEnrolmentRoute): EnrolmentAnswers | null =>
  enrolmentRoute.route
    ? {
        route: enrolmentRoute.route,
        has_finnish_personal_identity_code:
          enrolmentRoute.has_finnish_personal_identity_code ?? null,
        need: enrolmentRoute.need ?? null,
        identification: enrolmentRoute.identification ?? null,
        need_after_reconsider: enrolmentRoute.need_after_reconsider ?? null,
      }
    : null

/**
 * Saving the answers and the student's word on enrolling or on taking the certificate.
 *
 * Every write goes to each of `subjects`: a completion that earns several courses keeps a copy of
 * the answers per course, and each course's enrolment check reads its own. The first subject's
 * answers are the ones shown.
 *
 * Answers are written into the cache before the request, so the next question opens under the
 * click instead of after a round trip; a failed save puts the old answers back. `courseId` is
 * `null` before the pipeline has created the registration.
 */
export const useEnrolmentAnswers = (
  subjects: readonly [CreditRegistrationSubject, ...CreditRegistrationSubject[]],
  courseId: string | null,
) => {
  const queryClient = useQueryClient()
  const routeQueryKeys = subjects.map((subject) => myEnrolmentRouteQueryKey(subject))
  const forEachSubject = async (write: (subject: CreditRegistrationSubject) => Promise<void>) => {
    await Promise.all(subjects.map((subject) => write(subject)))
  }

  const invalidateRoute = async () => {
    await Promise.all(routeQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }
  // Confirming brings the next enrolment check forward, so the registration has moved too.
  const invalidateEverything = async () => {
    await Promise.all([invalidateRoute(), invalidateRegistrationViews(queryClient, courseId)])
  }

  // Each save replaces every answer, so saves run in order and only the last one refetches.
  const saveScopeId = `enrolment-answers-${subjectId(subjects[0])}`
  const saveAnswers = useToastMutation<
    void,
    unknown,
    EnrolmentAnswers,
    { previous: (MyEnrolmentRoute | null | undefined)[] }
  >(
    async (answers) => {
      await forEachSubject((subject) => setEnrolmentRoute(subject, answers))
    },
    { notify: false },
    {
      scope: { id: saveScopeId },
      onMutate: async (answers) => {
        const previous = await Promise.all(
          routeQueryKeys.map(async (queryKey) => {
            await queryClient.cancelQueries({ queryKey })
            const stored = queryClient.getQueryData<MyEnrolmentRoute | null>(queryKey)
            if (stored) {
              queryClient.setQueryData<MyEnrolmentRoute>(queryKey, { ...stored, ...answers })
            }
            return stored
          }),
        )
        return { previous }
      },
      onError: (_error, _answers, context) => {
        context?.previous.forEach((stored, index) => {
          const queryKey = routeQueryKeys[index]
          if (stored !== undefined && queryKey) {
            queryClient.setQueryData(queryKey, stored)
          }
        })
      },
      onSettled: async () => {
        const pendingSaves = queryClient.isMutating({
          predicate: (mutation) => mutation.options.scope?.id === saveScopeId,
        })
        if (pendingSaves === 1) {
          await invalidateRoute()
        }
      },
    },
  )

  const confirmEnrolment = useToastMutation<void, unknown, void>(
    async () => {
      await forEachSubject(confirmEnrolmentFor)
    },
    { notify: false },
    { onSuccess: invalidateEverything },
  )

  const withdrawEnrolmentConfirmation = useToastMutation<void, unknown, void>(
    async () => {
      await forEachSubject(withdrawEnrolmentConfirmationFor)
    },
    { notify: false },
    { onSuccess: invalidateEverything },
  )

  const chooseCertificate = useToastMutation<void, unknown, void>(
    async () => {
      await forEachSubject(chooseCertificateFor)
    },
    { notify: false },
    { onSuccess: invalidateRoute },
  )

  const withdrawCertificateChoice = useToastMutation<void, unknown, void>(
    async () => {
      await forEachSubject(withdrawCertificateChoiceFor)
    },
    { notify: false },
    { onSuccess: invalidateRoute },
  )

  const isError =
    saveAnswers.isError ||
    confirmEnrolment.isError ||
    withdrawEnrolmentConfirmation.isError ||
    chooseCertificate.isError ||
    withdrawCertificateChoice.isError

  return {
    saveAnswers,
    confirmEnrolment,
    withdrawEnrolmentConfirmation,
    chooseCertificate,
    withdrawCertificateChoice,
    isError,
  }
}

export type EnrolmentAnswerActions = ReturnType<typeof useEnrolmentAnswers>
