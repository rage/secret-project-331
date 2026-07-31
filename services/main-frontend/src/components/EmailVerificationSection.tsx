"use client"

import { css } from "@emotion/css"
import type { QueryClient } from "@tanstack/react-query"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Envelope } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { getMyEmailVerificationStatusOptions } from "@/generated/api/@tanstack/react-query.generated"
import { requestEmailVerificationLink } from "@/generated/api/sdk.generated"
import type {
  EmailSendStatus,
  EmailVerificationStatus,
  RequestEmailVerificationOutcome,
} from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Badge, Button, DescriptionList } from "@/shared-module/components"

const TONE_SUCCESS = "success"
const TONE_WARNING = "warning"

const SEND_STATUS_KEYS = {
  queued: "email-send-status-queued",
  retrying: "email-send-status-retrying",
  sent: "email-send-status-sent",
  send_failed: "email-send-status-send-failed",
} as const satisfies Record<EmailSendStatus, string>

const OUTCOME_KEYS = {
  queued: "message-email-verification-link-on-its-way",
  already_verified: "message-email-is-already-verified",
  recently_sent: "message-email-verification-link-was-just-sent",
  not_configured: "message-email-verification-is-not-available-right-now",
} as const satisfies Record<RequestEmailVerificationOutcome, string>

const cardCss = css`
  background: #fff;
  border: 1px solid var(--color-gray-100);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 1px 2px rgba(0, 0, 0, 0.02);
`

const headerCss = css`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: 1.25rem;
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-gray-100);

  h3 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--color-gray-700);
  }
`

const iconChipCss = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 6px;
  background: var(--color-green-75);
  color: var(--color-green-700);
`

const bodyCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: flex-start;

  p {
    margin: 0;
    color: var(--color-gray-700);
  }
`

const outcomeCss = css`
  color: var(--color-gray-600);
  font-size: var(--font-size-1);
`

/** Email changes clear verification server-side; callers must refetch after such an edit. */
export const refetchEmailVerificationStatusForUser = async (queryClient: QueryClient) => {
  await queryClient.refetchQueries({
    queryKey: getMyEmailVerificationStatusOptions().queryKey,
  })
}

const EmailVerificationSection: React.FC = () => {
  const { t } = useTranslation()
  const statusQuery = useQuery({ ...getMyEmailVerificationStatusOptions() })
  const status = statusQuery.data

  // No chrome until the status is known: a deployment without the feature shows no trace of it,
  // and a skeleton that then vanishes is worse than a card that arrives late.
  if (!status || !status.verification_configured) {
    return null
  }

  return (
    <div className={cardCss} data-testid="email-verification-section">
      <div className={headerCss}>
        <div className={iconChipCss}>
          <Envelope size={16} />
        </div>
        <h3>{t("heading-email-address-verification")}</h3>
      </div>
      <Body status={status} />
    </div>
  )
}

const Body: React.FC<{ status: EmailVerificationStatus }> = ({ status }) => {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [outcome, setOutcome] = React.useState<RequestEmailVerificationOutcome | null>(null)

  const requestLink = useToastMutation<RequestEmailVerificationOutcome, unknown, void>(
    async () => await requestEmailVerificationLink({ body: { language: i18n.language } }),
    { notify: false },
    {
      onSuccess: async (result) => {
        setOutcome(result)
        await queryClient.invalidateQueries({
          queryKey: getMyEmailVerificationStatusOptions().queryKey,
        })
      },
    },
  )

  const verified = status.email_verified_at !== null && status.email_verified_at !== undefined
  const lastEmail = status.latest_verification_email

  const items = [{ label: t("label-email"), value: status.email }]
  if (verified) {
    items.push({
      label: t("label-verified-at"),
      value: new Date(status.email_verified_at as string).toLocaleString(i18n.language),
    })
  } else if (lastEmail) {
    items.push(
      { label: t("label-verification-link-sent-to"), value: lastEmail.emailed_to },
      {
        label: t("label-verification-link-sent-at"),
        value: new Date(lastEmail.sent_at).toLocaleString(i18n.language),
      },
    )
    if (lastEmail.send_status) {
      items.push({
        label: t("label-our-send-status"),
        value: t(SEND_STATUS_KEYS[lastEmail.send_status.email_send_status]),
      })
    }
  }

  return (
    <div className={bodyCss}>
      <Badge tone={verified ? TONE_SUCCESS : TONE_WARNING}>
        {verified ? t("badge-email-verified") : t("badge-email-not-verified")}
      </Badge>

      <p>
        {verified
          ? t("message-email-verification-what-it-means")
          : t("message-email-not-verified-explanation")}
      </p>

      <DescriptionList items={items} />

      {verified ? null : (
        <Button
          variant="secondary"
          size="medium"
          isLoading={requestLink.isPending}
          onClick={() => requestLink.mutate()}
        >
          {lastEmail
            ? t("button-send-a-new-verification-link")
            : t("button-send-a-verification-link")}
        </Button>
      )}

      {outcome ? (
        <p className={outcomeCss} data-testid="email-verification-request-outcome">
          {t(OUTCOME_KEYS[outcome])}
        </p>
      ) : null}
    </div>
  )
}

export default EmailVerificationSection
