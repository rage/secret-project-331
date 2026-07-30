"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getOauthDeviceVerificationOptions } from "@/generated/api/@tanstack/react-query.generated"
import {
  approveOauthDeviceVerification,
  denyOauthDeviceVerification,
} from "@/generated/api/sdk.generated"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, type ButtonProps, TextField } from "@/shared-module/components"

interface DeviceCodeFields {
  userCode: string
}

// The shared Button has no destructive variant, so retint `secondary`'s own tokens rather
// than hardcode colours; this keeps the variant's hover/pressed/disabled behaviour intact.
const denyButtonStyles = css`
  --btn-secondary-fg: var(--color-red-700);
  --btn-secondary-bg-hover: var(--color-red-700);
  --btn-secondary-border-hover: var(--color-red-700);
`

// The system tests locate the consent buttons by these ids. Button spreads `domProps` onto the
// <button>, but ButtonHTMLAttributes has no data-* index signature, hence the casts.
type ButtonDomProps = NonNullable<ButtonProps["domProps"]>
// oxlint-disable-next-line i18next/no-literal-string
const approveButtonDomProps = { "data-testid": "oauth-device-approve-button" } as ButtonDomProps
// oxlint-disable-next-line i18next/no-literal-string
const denyButtonDomProps = { "data-testid": "oauth-device-deny-button" } as ButtonDomProps

const DeviceVerificationPage: React.FC = () => {
  const searchParams = useSearchParams()
  const { t } = useTranslation("main-frontend")
  usePageTitle(t("title-authorize-application"))

  const queryUserCode = searchParams.get("user_code") ?? ""
  // The code being verified, as opposed to the form field, which is what the user is typing.
  const [userCode, setUserCode] = useState(queryUserCode)
  const [approved, setApproved] = useState(false)
  const [denied, setDenied] = useState(false)
  const decided = approved || denied

  const { control, handleSubmit, watch } = useForm<DeviceCodeFields>({
    defaultValues: { userCode: queryUserCode },
  })
  const inputValue = watch("userCode")

  const verification = useQuery({
    ...getOauthDeviceVerificationOptions({ query: { user_code: userCode } }),
    enabled: userCode.length > 0 && !decided,
    retry: false,
  })

  const approveMutation = useToastMutation(
    async () => await approveOauthDeviceVerification({ body: { user_code: userCode } }),
    { method: "POST", notify: true },
    { onSuccess: () => setApproved(true) },
  )
  const denyMutation = useToastMutation(
    async () => await denyOauthDeviceVerification({ body: { user_code: userCode } }),
    { method: "POST", notify: true },
    { onSuccess: () => setDenied(true) },
  )

  const scopeDescriptions: Record<string, string> = {
    openid: t("oauth-scope-description-openid"),
    email: t("oauth-scope-description-email"),
    profile: t("oauth-scope-description-profile"),
    offline_access: t("oauth-scope-description-offline-access"),
    "exercise-services": t("oauth-scope-description-exercise-services"),
  }

  const sectionClass = css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    max-width: 600px;
    margin: auto;
  `

  if (approved) {
    return (
      <section className={sectionClass} data-testid="oauth-device-approved">
        <p>{t("oauth-device-approve-success")}</p>
      </section>
    )
  }

  if (denied) {
    return (
      <section className={sectionClass} data-testid="oauth-device-denied">
        <p>{t("oauth-device-deny-success")}</p>
      </section>
    )
  }

  // Also shown after a failed lookup (invalid or expired code) so the user can retry.
  const showEntryForm = userCode.length === 0 || verification.isError

  return (
    <section
      aria-label={t("oauth-application-requesting-access")}
      data-testid="oauth-device-form"
      className={sectionClass}
    >
      {showEntryForm && (
        <form onSubmit={handleSubmit((fields) => setUserCode(fields.userCode.trim()))}>
          {/* TextField takes no DOM escape hatch, so the test hook lives on a wrapper. */}
          <div data-testid="oauth-device-user-code-input">
            <TextField
              name="userCode"
              control={control}
              label={t("oauth-device-user-code-label")}
              description={t("oauth-device-enter-code")}
            />
          </div>
          {verification.isError && (
            <p data-testid="oauth-device-error">{t("oauth-device-code-not-found")}</p>
          )}
          <Button variant="primary" size="large" type="submit" disabled={!inputValue.trim()}>
            {t("button-text-submit")}
          </Button>
        </form>
      )}

      {userCode.length > 0 && verification.isPending && <Spinner variant="medium" />}

      {verification.isSuccess && (
        <>
          <h2>{verification.data.client_name}</h2>
          <p>{t("oauth-application-requesting-access")}</p>
          <ul>
            {verification.data.scopes.map((scope) => (
              <li key={scope}>
                <strong>{scope}</strong>:{" "}
                {scopeDescriptions[scope] || t("oauth-scope-description-no-description")}
              </li>
            ))}
          </ul>
          <div
            className={css`
              display: flex;
              gap: 10px;
            `}
          >
            <Button
              variant="primary"
              size="large"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || denyMutation.isPending}
              aria-label={t("approve")}
              domProps={approveButtonDomProps}
            >
              {t("approve")}
            </Button>
            <Button
              variant="secondary"
              size="large"
              className={denyButtonStyles}
              onClick={() => denyMutation.mutate()}
              disabled={approveMutation.isPending || denyMutation.isPending}
              aria-label={t("button-text-cancel")}
              domProps={denyButtonDomProps}
            >
              {t("button-text-cancel")}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

export default withErrorBoundary(withSignedIn(DeviceVerificationPage))
