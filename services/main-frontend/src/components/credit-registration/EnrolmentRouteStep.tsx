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
import { dateToString } from "@/shared-module/common/utils/time"
import { Button, Infobox, Link, Radio, RadioGroup, TransLink } from "@/shared-module/components"
import { httpsUrlOrNull } from "@/utils/httpsUrl"

import {
  BUTTON_PRIMARY,
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  OPEN_UNIVERSITY,
  openUniversityEnrolmentInfoUrl,
  ROUTE_FIELD,
  SEGMENTED,
  SISU_URL,
  SUPPORT_EMAIL,
  SUPPORT_MAIL_INLINE,
  TONE,
  UNIVERSITY_OF_HELSINKI,
} from "./constants"
import { enrolmentConfirmedSentence } from "./creditRegistrationCopy"
import { invalidateRegistrationViews } from "./enrolmentActions"
import { OpenUniversityDetour } from "./OpenUniversityDetour"
import { SisuCourseCode } from "./SisuCourseCode"
import type { SupportMailContents } from "./studentSupportMail"
import { bandCss, rowCss } from "./styles"
import SupportMailLink from "./SupportMailLink"

interface RouteForm {
  [ROUTE_FIELD]: string
}

export interface EnrolmentRouteStepProps {
  courseId: string
  courseModuleId: string
  enrolmentRoute: MyEnrolmentRoute
  /** Where a student who is not at the University is sent to enrol, when the module names one. */
  openUniversityEnrolmentLink: string | null | undefined
  /** The Sisu course to enrol on. Without one the Sisu route is replaced by a support contact. */
  uhCourseCode: string | null | undefined
  /** What the support mail says when there is no course code to enrol on. */
  supportMail: SupportMailContents
  /** Set when a certificate could serve instead, which asks the detour questions first. */
  certificateConfigurationId: string | null | undefined
  /** What the student wrote on the detour's last question, if they got that far. */
  creditJustification: string | null | undefined
}

/**
 * The one part of the registration the student drives: which university relationship they have,
 * where that means they have to enrol, and their word that they have.
 *
 * Two bands rather than one, so the card reads the way the completion page does: the question, then
 * what the answer asks of them. Rendered only while the answer can still change something.
 */
export const EnrolmentRouteStep: React.FC<EnrolmentRouteStepProps> = ({
  courseId,
  courseModuleId,
  enrolmentRoute,
  openUniversityEnrolmentLink,
  uhCourseCode,
  supportMail,
  certificateConfigurationId,
  creditJustification,
}) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const { control, watch, reset } = useForm<RouteForm>({
    defaultValues: { [ROUTE_FIELD]: enrolmentRoute.route ?? "" },
  })
  const picked = watch(ROUTE_FIELD)
  const enrolmentLink = httpsUrlOrNull(openUniversityEnrolmentLink)
  const sisuCourseCode = uhCourseCode?.trim() || null

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: getMyEnrolmentRouteQueryKey({ path: { course_module_id: courseModuleId } }),
    })
  }

  // Destructured because react-query keeps `mutate` stable while the mutation object is not, and
  // the effect below has to list what it calls.
  const { mutate: saveRoute, isError: saveFailed } = useToastMutation<
    void,
    unknown,
    CreditRegistrationEnrolmentRoute
  >(
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
    {
      // Pressing Done also brings the next enrolment check forward, so the registration the rest of
      // the page is drawn from has moved too.
      onSuccess: async () => {
        await Promise.all([invalidate(), invalidateRegistrationViews(queryClient, courseId)])
      },
    },
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

  // None of the three mutations toasts, so this is the only place a failed save is reported; the
  // answer is a radio and a button that otherwise just look as though nothing happened.
  const saveError =
    saveFailed || confirm.isError || withdraw.isError ? (
      <section className={bandCss}>
        <Infobox tone={TONE.DANGER}>
          {t("credit-registration-enrolment-answer-save-failed")}
        </Infobox>
      </section>
    ) : null

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

  const openUniversityEnrolment = (
    <section className={bandCss}>
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
        {enrolmentLink ? (
          <Link
            href={enrolmentLink}
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
  )

  if (enrolmentRoute.enrolment_confirmed_at) {
    return (
      <>
        {saveError}
        <section className={bandCss}>
          <p>
            {enrolmentConfirmedSentence(
              t,
              enrolmentRoute.route,
              dateToString(enrolmentRoute.enrolment_confirmed_at),
            )}
          </p>
          {enrolmentRoute.route === OPEN_UNIVERSITY ? (
            <p>{t("credit-registration-open-university-acceptance-takes-days")}</p>
          ) : null}
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
      </>
    )
  }

  return (
    <>
      {saveError}
      <section className={bandCss}>
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
        <section className={bandCss}>
          {sisuCourseCode ? (
            <>
              <p>
                <Trans
                  t={t}
                  i18nKey="credit-registration-enrol-in-sisu-on-course"
                  components={{
                    courseCode: <SisuCourseCode code={sisuCourseCode} />,
                  }}
                />
              </p>
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
            </>
          ) : (
            <>
              <p>
                {t("credit-registration-sisu-course-code-missing")}{" "}
                <SupportMailLink
                  appearance={SUPPORT_MAIL_INLINE}
                  label={SUPPORT_EMAIL}
                  subject={supportMail.subject}
                  bodyLines={supportMail.bodyLines}
                />
              </p>
              <SupportMailLink
                referenceOnly
                reference={supportMail.reference ?? null}
                subject={supportMail.subject}
                bodyLines={supportMail.bodyLines}
              />
            </>
          )}
        </section>
      ) : null}

      {picked === OPEN_UNIVERSITY ? (
        certificateConfigurationId ? (
          <OpenUniversityDetour
            courseModuleId={courseModuleId}
            certificateConfigurationId={certificateConfigurationId}
            creditJustification={creditJustification}
            openUniversityContent={openUniversityEnrolment}
          />
        ) : (
          openUniversityEnrolment
        )
      ) : null}
    </>
  )
}
