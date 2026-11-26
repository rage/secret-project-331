"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { AuthCard, AuthCardFooterLink, authCardStackCss } from "@/components/auth/AuthCard"
import { getOauthDeviceVerificationOptions } from "@/generated/api/@tanstack/react-query.generated"
import {
  approveOauthDeviceVerification,
  denyOauthDeviceVerification,
} from "@/generated/api/sdk.generated"
import type { DeviceVerificationInfo } from "@/generated/api/types.generated"
import { useUserDetails } from "@/hooks/course-material/useUserDetails"
import { formatUserName } from "@/hooks/useUserDetails"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useLogout from "@/shared-module/common/hooks/useLogout"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { monospaceFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  Button,
  focusProgrammatically,
  Infobox,
  LoadingRegion,
  TextField,
  TONE,
} from "@/shared-module/components"
import { getOauthScopeDescriptions } from "@/utils/oauthScopeDescriptions"

interface DeviceCodeFields {
  userCode: string
}

type Decision = "approved" | "denied"

// `danger` is a solid fill that would outweigh Approve, so retint `secondary`'s own tokens rather
// than hardcode colours; this keeps the variant's hover/pressed/disabled behaviour intact.
const denyButtonStyles = css`
  --btn-secondary-fg: var(--color-red-700);
  --btn-secondary-bg-hover: var(--color-red-700);
  --btn-secondary-border-hover: var(--color-red-700);
`

const sectionLabelCss = css`
  margin: 0 0 0.5rem;
  font-size: var(--font-size-2);
  line-height: 1.5;
  color: var(--color-gray-700);
`

const userCodeCss = css`
  margin: 0;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-clear-400);
  border-radius: var(--radius-3);
  background: var(--color-clear-100);
  font-family: ${monospaceFont};
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-align: center;
  color: var(--color-gray-800);
`

const scopeListCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--color-clear-300);
    border-radius: var(--radius-3);
    font-size: var(--font-size-1);
    line-height: 1.45;
    color: var(--color-gray-600);
  }
`

const scopeNameCss = css`
  display: block;
  font-family: ${monospaceFont};
  font-weight: 600;
  color: var(--color-gray-800);
  overflow-wrap: anywhere;
`

const decisionButtonsCss = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
`

const DeviceVerificationPage: React.FC = () => {
  const { t } = useTranslation("main-frontend")
  usePageTitle(t("title-authorize-application"))

  const queryUserCode = useQueryParameter("user_code")
  // The code being verified, as opposed to the form field, which is what the user is typing.
  const [userCode, setUserCode] = useState(queryUserCode)
  const [decision, setDecision] = useState<Decision | null>(null)
  const resultHeadingRef = useRef<HTMLHeadingElement>(null)

  const { control, handleSubmit, watch, setFocus } = useForm<DeviceCodeFields>({
    defaultValues: { userCode: queryUserCode },
  })
  const inputValue = watch("userCode")

  const verification = useQuery({
    ...getOauthDeviceVerificationOptions({ query: { user_code: userCode } }),
    enabled: userCode.length > 0 && decision === null,
    retry: false,
  })

  const approveMutation = useToastMutation(
    async () => await approveOauthDeviceVerification({ body: { user_code: userCode } }),
    { method: "POST", notify: true },
    // oxlint-disable-next-line i18next/no-literal-string -- state value
    { onSuccess: () => setDecision("approved") },
  )
  const denyMutation = useToastMutation(
    async () => await denyOauthDeviceVerification({ body: { user_code: userCode } }),
    { method: "POST", notify: true },
    // oxlint-disable-next-line i18next/no-literal-string -- state value
    { onSuccess: () => setDecision("denied") },
  )

  // Also shown after a failed lookup (invalid or expired code) so the user can retry.
  const showEntryForm = decision === null && (userCode.length === 0 || verification.isError)

  useEffect(() => {
    if (decision !== null && resultHeadingRef.current) {
      return focusProgrammatically(resultHeadingRef.current)
    }
    if (showEntryForm) {
      // oxlint-disable-next-line i18next/no-literal-string -- form field name
      setFocus("userCode")
    }
    return undefined
  }, [decision, showEntryForm, setFocus])

  const resultDescription =
    decision === "approved"
      ? t("oauth-device-approved-description")
      : decision === "denied"
        ? t("oauth-device-denied-description")
        : null

  let card: React.ReactNode = null
  if (decision !== null) {
    card = (
      <div data-testid={decision === "approved" ? "oauth-device-approved" : "oauth-device-denied"}>
        <AuthCard
          headingRef={resultHeadingRef}
          title={
            decision === "approved"
              ? t("oauth-device-approved-title")
              : t("oauth-device-denied-title")
          }
          // oxlint-disable-next-line i18next/no-literal-string -- AuthCard enum value
          statusIcon={decision === "approved" ? "success" : "warning"}
          lede={resultDescription}
        />
      </div>
    )
  } else if (showEntryForm) {
    card = (
      <AuthCard title={t("title-authorize-application")} lede={t("oauth-device-enter-code")}>
        <form
          onSubmit={handleSubmit((fields) => setUserCode(fields.userCode.trim()))}
          className={authCardStackCss}
        >
          {/* TextField takes no DOM escape hatch, so the test hook lives on a wrapper. */}
          <div data-testid="oauth-device-user-code-input">
            <TextField
              name="userCode"
              control={control}
              label={t("oauth-device-user-code-label")}
              autoComplete="off"
            />
          </div>
          {verification.isError && (
            <Infobox tone={TONE.DANGER} announce>
              {t("oauth-device-code-not-found")}
            </Infobox>
          )}
          <Button
            variant="primary"
            size="large"
            type="submit"
            isFullWidth
            disabled={!inputValue.trim()}
          >
            {t("button-text-submit")}
          </Button>
        </form>
      </AuthCard>
    )
  } else if (verification.isSuccess) {
    card = (
      <DeviceConsentCard
        info={verification.data}
        onApprove={() => approveMutation.mutate()}
        onDeny={() => denyMutation.mutate()}
        isDeciding={approveMutation.isPending || denyMutation.isPending}
      />
    )
  } else {
    card = <LoadingRegion />
  }

  return (
    <>
      {card}
      {/* Mounted in every state so screen readers already track it when the result arrives. */}
      <VisuallyHidden>
        <p role="status">{resultDescription}</p>
      </VisuallyHidden>
    </>
  )
}

interface DeviceConsentCardProps {
  info: DeviceVerificationInfo
  onApprove: () => void
  onDeny: () => void
  isDeciding: boolean
}

const DeviceConsentCard: React.FC<DeviceConsentCardProps> = ({
  info,
  onApprove,
  onDeny,
  isDeciding,
}) => {
  const { t } = useTranslation("main-frontend")
  const scopeDescriptions = getOauthScopeDescriptions(t)

  return (
    <div data-testid="oauth-device-form">
      <AuthCard
        title={t("oauth-device-client-requesting-access", { clientName: info.client_name })}
        footer={<SignedInAccount />}
      >
        <div>
          {/* RFC 8628 §5.4: the user can only spot a phished code if they can compare it. */}
          <p className={sectionLabelCss}>{t("oauth-device-compare-code")}</p>
          <p className={userCodeCss} dir="ltr" data-testid="oauth-device-user-code">
            {info.user_code}
          </p>
        </div>
        <div>
          <p className={sectionLabelCss}>{t("oauth-application-requesting-access")}</p>
          <ul className={scopeListCss}>
            {info.scopes.map((scope) => (
              <li key={scope}>
                <span className={scopeNameCss}>{scope}</span>
                {scopeDescriptions[scope] || t("oauth-scope-description-no-description")}
              </li>
            ))}
          </ul>
        </div>
        <div className={decisionButtonsCss}>
          <Button
            variant="primary"
            size="large"
            isFullWidth
            onClick={onApprove}
            disabled={isDeciding}
            data-testid="oauth-device-approve-button"
          >
            {t("approve")}
          </Button>
          <Button
            variant="secondary"
            size="large"
            isFullWidth
            className={denyButtonStyles}
            onClick={onDeny}
            disabled={isDeciding}
            data-testid="oauth-device-deny-button"
          >
            {t("button-text-cancel")}
          </Button>
        </div>
      </AuthCard>
    </div>
  )
}

/** Which account the approval is for, with a way to switch before approving. */
const SignedInAccount: React.FC = () => {
  const { t } = useTranslation("main-frontend")
  const userDetails = useUserDetails()
  const { logout } = useLogout()
  const details = userDetails.data
  if (!details) {
    return null
  }
  const name = formatUserName(details)
  return (
    <div data-testid="oauth-device-signed-in-account">
      <AuthCardFooterLink
        prompt={t("oauth-device-signed-in-as", {
          account: name ? `${name} (${details.email})` : details.email,
        })}
        onPress={() => void logout()}
      >
        {t("oauth-device-use-another-account")}
      </AuthCardFooterLink>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(DeviceVerificationPage))
