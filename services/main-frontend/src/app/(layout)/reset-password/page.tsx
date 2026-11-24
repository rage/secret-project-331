"use client"

import { css } from "@emotion/css"
import { Clock, InboxMailbox } from "@vectopus/atlas-icons-react"
import { millisecondsInMinute } from "date-fns/constants"
import i18n from "i18next"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import { AuthCard, AuthCardFooterLink, authCardStackCss } from "@/components/auth/AuthCard"
import {
  RESET_EMAIL_RESEND_COOLDOWN_MS,
  RESET_LINK_LIFETIME_HOURS,
} from "@/components/auth/passwordReset"
import AltchaWidget, { type AltchaWidgetHandle } from "@/components/forms/AltchaWidget"
import { sendResetPasswordEmail } from "@/generated/api/sdk.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { isBoolean } from "@/shared-module/common/utils/fetching"
import { validateReturnToRouteOrDefault } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import { loginRoute } from "@/shared-module/common/utils/routes"
import { EMAIL_PATTERN } from "@/shared-module/common/utils/validation"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, ErrorNotice, focusProgrammatically, TextField } from "@/shared-module/components"
import { validateGeneratedData } from "@/utils/validateGeneratedData"

interface SubmitEmailFormFields {
  email: string
}

const factsListCss = css`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-1);
  line-height: 1.45;
  color: var(--color-gray-600);

  li {
    display: grid;
    grid-template-columns: 18px 1fr;
    gap: 0.625rem;
    align-items: start;
  }
`

const factIconCss = css`
  display: inline-flex;
  margin-top: 2px;
  color: var(--color-blue-500);
`

const resendNoteCss = css`
  margin: 0;
  text-align: center;
  font-size: var(--font-size-1);
  color: var(--color-gray-500);
  font-variant-numeric: tabular-nums;

  &:not(:empty) {
    margin-top: 0.5rem;
  }
`

/**
 * Milliseconds left of a cooldown that began at `startedAt`; 0 when over. Re-renders only when the
 * remaining whole minutes change, so callers should display it in minutes.
 */
function useCooldownRemainingMs(startedAt: number | null, durationMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  // Clamped because `now` only advances while a cooldown runs, so it can be stale when a new one starts.
  const remainingMs =
    startedAt === null ? 0 : Math.min(durationMs, Math.max(0, startedAt + durationMs - now))

  useEffect(() => {
    if (remainingMs <= 0) {
      return
    }
    const msToNextMinuteChange = remainingMs % millisecondsInMinute || millisecondsInMinute
    const timeout = setTimeout(() => setNow(Date.now()), msToNextMinuteChange)
    return () => clearTimeout(timeout)
  }, [remainingMs])

  return remainingMs
}

const ResetPassword: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-reset-password"))
  const uncheckedReturnTo = useQueryParameter("return_to")
  const loginHref = loginRoute(validateReturnToRouteOrDefault(uncheckedReturnTo, "/"))
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [lastSentAt, setLastSentAt] = useState<number | null>(null)
  const [isResent, setIsResent] = useState(false)
  const altchaRef = useRef<AltchaWidgetHandle>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { control, handleSubmit, setFocus } = useForm<SubmitEmailFormFields>({
    defaultValues: { email: "" },
  })
  const cooldownRemainingMs = useCooldownRemainingMs(lastSentAt, RESET_EMAIL_RESEND_COOLDOWN_MS)

  useEffect(() => {
    if (sentEmail !== null && headingRef.current) {
      return focusProgrammatically(headingRef.current)
    }
    // oxlint-disable-next-line i18next/no-literal-string
    setFocus("email")
    return undefined
  }, [sentEmail, setFocus])

  // Bumped by "Use a different email" so a request still in flight can't reopen the sent state.
  const sendGenerationRef = useRef(0)

  const postResetPassword = useToastMutation(
    async (data: SubmitEmailFormFields & { generation: number }) => {
      const altcha = (await altchaRef.current?.solve()) ?? ""
      return validateGeneratedData(
        await sendResetPasswordEmail({
          body: {
            email: data.email,
            language: i18n.language,
            altcha,
          },
        }),
        isBoolean,
      )
    },
    { method: "POST", notify: true },
    {
      onSuccess: (_, variables) => {
        if (variables.generation !== sendGenerationRef.current) {
          return
        }
        setSentEmail(variables.email)
        setLastSentAt(Date.now())
      },
    },
  )

  const isSent = sentEmail !== null
  const isCoolingDown = cooldownRemainingMs > 0
  const cooldownNote = isCoolingDown
    ? t("password-reset-send-again-wait", {
        minutes: Math.ceil(cooldownRemainingMs / millisecondsInMinute),
      })
    : undefined

  const apiError = postResetPassword.isError && (
    // notify:true already announces the error via the toast; the notice is the persistent copy.
    // oxlint-disable-next-line i18next/no-literal-string -- ErrorNotice enum values, not UI text
    <ErrorNotice error={postResetPassword.error} announce="off" density="compact" />
  )

  return (
    <AuthCard
      headingRef={headingRef}
      title={isSent ? t("password-reset-check-your-email") : t("title-reset-password")}
      // oxlint-disable-next-line i18next/no-literal-string -- AuthCard enum value
      statusIcon={isSent ? "mail" : undefined}
      lede={
        isSent ? (
          <Trans t={t} i18nKey="password-reset-email-sent-to" values={{ email: sentEmail }} />
        ) : (
          t("enter-email-for-password-reset-link")
        )
      }
      footer={
        <>
          {isSent && (
            <AuthCardFooterLink
              prompt={t("password-reset-wrong-address")}
              onPress={() => {
                sendGenerationRef.current += 1
                postResetPassword.reset()
                setIsResent(false)
                setSentEmail(null)
              }}
            >
              {t("password-reset-use-different-email")}
            </AuthCardFooterLink>
          )}
          <AuthCardFooterLink prompt={t("remembered-your-password")} href={loginHref}>
            {t("login")}
          </AuthCardFooterLink>
        </>
      }
    >
      {isSent ? (
        <>
          <ul className={factsListCss}>
            <li>
              <span className={factIconCss} aria-hidden="true">
                <Clock size={16} />
              </span>
              <span>
                {t("password-reset-link-valid-for", { count: RESET_LINK_LIFETIME_HOURS })}
              </span>
            </li>
            <li>
              <span className={factIconCss} aria-hidden="true">
                <InboxMailbox size={16} />
              </span>
              <span>{t("password-reset-check-spam")}</span>
            </li>
          </ul>
          {apiError}
          <div>
            <Button
              variant="secondary"
              size="large"
              isFullWidth
              isLoading={postResetPassword.isPending}
              disabledReason={cooldownNote}
              onPress={() => {
                setIsResent(false)
                postResetPassword.mutate(
                  { email: sentEmail, generation: sendGenerationRef.current },
                  { onSuccess: () => setIsResent(true) },
                )
              }}
            >
              {t("password-reset-send-again")}
            </Button>
            {/* Stays mounted so screen readers have registered it before the message appears. */}
            <p className={resendNoteCss} role="status">
              {isResent ? t("password-reset-sent-again") : null}
            </p>
            <p className={resendNoteCss}>{cooldownNote}</p>
          </div>
        </>
      ) : (
        <form
          noValidate
          onSubmit={handleSubmit((data) =>
            postResetPassword.mutate({ ...data, generation: sendGenerationRef.current }),
          )}
          className={authCardStackCss}
        >
          {apiError}
          <TextField
            name="email"
            control={control}
            label={t("email")}
            type="email"
            autoComplete="email"
            isRequired
            rules={{
              required: t("required-field"),
              pattern: {
                value: EMAIL_PATTERN,
                message: t("enter-a-valid-email"),
              },
            }}
          />
          <Button
            variant="primary"
            size="large"
            type="submit"
            isFullWidth
            isLoading={postResetPassword.isPending}
          >
            {t("password-reset-send-link")}
          </Button>
        </form>
      )}
      {/* Rendered outside both states so its next solve survives the switch to the sent state. */}
      {/* oxlint-disable-next-line i18next/no-literal-string -- API value */}
      <AltchaWidget ref={altchaRef} purpose={"password_reset"} />
    </AuthCard>
  )
}

export default withErrorBoundary(ResetPassword)
