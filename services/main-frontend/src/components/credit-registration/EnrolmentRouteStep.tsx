"use client"

import { useQueryClient } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import { getMyEnrolmentRouteQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import {
  confirmMyEnrolment,
  setMyEnrolmentRoute,
  withdrawMyEnrolmentConfirmation,
} from "@/generated/api/sdk.generated"
import type {
  CreditRegistrationEnrolmentRoute,
  MyEnrolmentRoute,
} from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button, Link, Radio, RadioGroup, TransLink } from "@/shared-module/components"

import {
  BUTTON_PRIMARY,
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  OPEN_UNIVERSITY,
  openUniversityEnrolmentInfoUrl,
  ROUTE_FIELD,
  SEGMENTED,
  SISU_URL,
  UNIVERSITY_OF_HELSINKI,
} from "./constants"
import { rowCss, sectionCss } from "./styles"

interface RouteForm {
  [ROUTE_FIELD]: string
}

export interface EnrolmentRouteStepProps {
  courseModuleId: string
  enrolmentRoute: MyEnrolmentRoute
  /** Where a student who is not at the University is sent to enrol, when the module names one. */
  openUniversityEnrolmentLink: string | null | undefined
}

/**
 * The one part of the registration the student drives: which university relationship they have,
 * where that means they have to enrol, and their word that they have.
 *
 * Two bands rather than one, so the card reads the way the completion page does: the question, then
 * what the answer asks of them. Rendered only while the answer can still change something.
 */
export const EnrolmentRouteStep: React.FC<EnrolmentRouteStepProps> = ({
  courseModuleId,
  enrolmentRoute,
  openUniversityEnrolmentLink,
}) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const { control, watch, reset } = useForm<RouteForm>({
    defaultValues: { [ROUTE_FIELD]: enrolmentRoute.route ?? "" },
  })
  const picked = watch(ROUTE_FIELD)

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: getMyEnrolmentRouteQueryKey({ path: { course_module_id: courseModuleId } }),
    })
  }

  // Destructured because react-query keeps `mutate` stable while the mutation object is not, and
  // the effect below has to list what it calls.
  const { mutate: saveRoute } = useToastMutation<void, unknown, CreditRegistrationEnrolmentRoute>(
    async (route) => {
      await setMyEnrolmentRoute({ path: { course_module_id: courseModuleId }, body: { route } })
    },
    { notify: false },
    { onSuccess: invalidate },
  )

  const confirm = useToastMutation<void, unknown, void>(
    async () => {
      await confirmMyEnrolment({ path: { course_module_id: courseModuleId } })
    },
    { notify: false },
    { onSuccess: invalidate },
  )

  const withdraw = useToastMutation<void, unknown, void>(
    async () => {
      await withdrawMyEnrolmentConfirmation({ path: { course_module_id: courseModuleId } })
    },
    { notify: false },
    { onSuccess: invalidate },
  )

  // The field is the only place the answer is entered, so it is what reports a change; the stored
  // answer coming back from the server then re-seeds it.
  const stored = enrolmentRoute.route ?? ""
  useEffect(() => {
    reset({ [ROUTE_FIELD]: stored })
  }, [reset, stored])
  useEffect(() => {
    if (picked !== "" && picked !== stored) {
      saveRoute(picked as CreditRegistrationEnrolmentRoute)
    }
  }, [picked, saveRoute, stored])

  const iHaveEnrolled = (
    <Button
      variant={BUTTON_TERTIARY}
      size="medium"
      isLoading={confirm.isPending}
      onClick={() => confirm.mutate()}
    >
      {t("button-i-have-enrolled")}
    </Button>
  )

  if (enrolmentRoute.enrolment_confirmed_at) {
    return (
      <section className={sectionCss}>
        <p>{t("credit-registration-you-told-us-you-enrolled")}</p>
        <div>
          <Button
            variant={BUTTON_TERTIARY}
            size="medium"
            isLoading={withdraw.isPending}
            onClick={() => withdraw.mutate()}
          >
            {t("button-change-my-answer")}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className={sectionCss}>
        <RadioGroup
          name={ROUTE_FIELD}
          control={control}
          variant={SEGMENTED}
          label={t("are-you-a-student-or-exchange-student-at-uh")}
          description={t("open-university-students-and-everyone-else-select-no")}
        >
          <Radio value={UNIVERSITY_OF_HELSINKI} label={t("yes")} />
          <Radio value={OPEN_UNIVERSITY} label={t("no")} />
        </RadioGroup>
      </section>

      {picked === UNIVERSITY_OF_HELSINKI ? (
        <section className={sectionCss}>
          <p>{t("enroll-through-sisu-to-register-credits")}</p>
          <div className={rowCss}>
            <Link
              href={SISU_URL}
              target="_blank"
              rel="noopener noreferrer"
              styledAsButton
              variant={BUTTON_PRIMARY}
              size="medium"
            >
              {t("go-to-sisu")}
            </Link>
            {iHaveEnrolled}
          </div>
        </section>
      ) : null}

      {picked === OPEN_UNIVERSITY ? (
        <section className={sectionCss}>
          <p>
            <Trans
              t={t}
              i18nKey="credit-registration-open-university-enrol-explanation"
              components={{
                openUniversityInfoLink: (
                  <TransLink
                    href={openUniversityEnrolmentInfoUrl(i18n.language)}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                ),
              }}
            />
          </p>
          <div className={rowCss}>
            {openUniversityEnrolmentLink ? (
              <Link
                href={openUniversityEnrolmentLink}
                target="_blank"
                rel="noopener noreferrer"
                styledAsButton
                variant={BUTTON_PRIMARY}
                size="medium"
              >
                {t("credit-registration-action-enrol")}
              </Link>
            ) : null}
            {iHaveEnrolled}
          </div>
        </section>
      ) : null}
    </>
  )
}
