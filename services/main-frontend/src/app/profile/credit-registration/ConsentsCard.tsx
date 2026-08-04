"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckShield } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import SectionCard from "@/components/credit-registration/SectionCard"
import {
  getMyCreditRegistrationConsentsOptions,
  getMyCreditRegistrationConsentsQueryKey,
  getMyCreditRegistrationsQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { setMyCourseCreditRegistrationConsent } from "@/generated/api/sdk.generated"
import type {
  MyCreditRegistrationConsent,
  SetMyCourseCreditRegistrationConsentResult,
} from "@/generated/api/types.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import type { TableColumn } from "@/shared-module/components"
import { Button, QueryResult, Table } from "@/shared-module/components"

import { EM_DASH } from "../constants"

const noteCss = css`
  margin: 0;
  color: var(--color-gray-600);
  font-size: var(--font-size-1);
  line-height: 1.55;
`

const outcomeCss = css`
  margin: 0;
  color: var(--color-gray-700);
`

/** The catch-up path for completions predating the course's opt-in, and for a dismissed dialog. */
const ConsentsCard: React.FC = () => {
  const { t } = useTranslation()
  const query = useQuery({ ...getMyCreditRegistrationConsentsOptions() })

  return (
    <SectionCard
      icon={<CheckShield size={16} />}
      title={t("heading-permission-to-register-credits")}
    >
      <QueryResult query={query} treatEmptyAsData>
        {(consents) => <ConsentsTable consents={consents} />}
      </QueryResult>
    </SectionCard>
  )
}

const ConsentsTable: React.FC<{ consents: MyCreditRegistrationConsent[] }> = ({ consents }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { confirm } = useDialog()
  const [unblocked, setUnblocked] = React.useState<number | null>(null)

  const answer = useToastMutation<
    SetMyCourseCreditRegistrationConsentResult,
    unknown,
    { courseId: string; consentGiven: boolean }
  >(
    async ({ courseId, consentGiven }) =>
      await setMyCourseCreditRegistrationConsent({
        path: { course_id: courseId },
        body: { consent_given: consentGiven },
      }),
    { notify: true, method: "PUT" },
    {
      onSuccess: async (result) => {
        setUnblocked(result.newly_unblocked_registration_count)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationConsentsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationsQueryKey() }),
        ])
      },
    },
  )

  const answerText = (consent: MyCreditRegistrationConsent): string => {
    if (consent.consent_given === true) {
      return t("credit-registration-consent-answer-yes", {
        date: consent.consent_given_at ? dateToString(consent.consent_given_at, false) : EM_DASH,
      })
    }
    if (consent.consent_given === false) {
      return t("credit-registration-consent-answer-no", {
        date: consent.consent_withdrawn_at
          ? dateToString(consent.consent_withdrawn_at, false)
          : EM_DASH,
      })
    }
    return t("credit-registration-consent-answer-not-asked")
  }

  const columns: TableColumn<MyCreditRegistrationConsent>[] = [
    { header: t("label-course"), cell: (consent) => consent.course_name },
    { header: t("label-your-answer"), cell: answerText },
    {
      header: t("label-registered-credits"),
      cell: (consent) => consent.registered_count,
    },
    {
      header: t("actions"),
      cell: (consent) =>
        consent.consent_given === true ? (
          <Button
            variant="secondary"
            size="small"
            disabled={answer.isPending}
            onClick={async () => {
              const confirmed = await confirm(
                t("confirm-withdraw-credit-registration-consent-message"),
                t("confirm-withdraw-credit-registration-consent-title"),
              )
              if (confirmed) {
                answer.mutate({ courseId: consent.course_id, consentGiven: false })
              }
            }}
          >
            {t("button-withdraw-credit-registration-consent")}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="small"
            disabled={answer.isPending}
            onClick={() => answer.mutate({ courseId: consent.course_id, consentGiven: true })}
          >
            {consent.registrable_completion_count > 0
              ? t("button-allow-credit-registration-with-completions", {
                  count: consent.registrable_completion_count,
                })
              : t("button-allow-credit-registration")}
          </Button>
        ),
    },
  ]

  return (
    <>
      <Table
        columns={columns}
        rows={consents}
        rowKey={(consent) => consent.course_id}
        caption={t("heading-permission-to-register-credits")}
      />
      {unblocked !== null && unblocked > 0 ? (
        <p className={outcomeCss} data-testid="credit-registration-newly-unblocked">
          {t("credit-registration-newly-unblocked", { count: unblocked })}
        </p>
      ) : null}
      <p className={noteCss}>{t("credit-registration-withdraw-consent-note")}</p>
    </>
  )
}

export default withErrorBoundary(ConsentsCard)
