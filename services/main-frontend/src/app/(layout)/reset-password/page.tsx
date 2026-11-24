"use client"

import { css } from "@emotion/css"
import { Clock, InboxMailbox } from "@vectopus/atlas-icons-react"
import { secondsInMinute } from "date-fns/constants"
import i18n from "i18next"
import { useEffect, useRef, useState } from "react"
import { type Control, useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import {
  AuthCard,
  AuthCardFooterLink,
  type AuthCardProps,
  authCardStackCss,
} from "@/components/auth/AuthCard"
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
import {
  Button,
  ErrorNotice,
  focusProgrammatically,
  TextField,
  useCooldown,
} from "@/shared-module/components"
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

interface RequestLinkFormProps {
  control: Control<SubmitEmailFormFields>
  onSubmit: React.FormEventHandler<HTMLFormElement>
  isSending: boolean
  apiError: React.ReactNode
}

const RequestLinkForm: React.FC<RequestLinkFormProps> = ({
  control,
  onSubmit,
  isSending,
  apiError,
}) => {
  const { t } = useTranslation()
  return (
    <form noValidate onSubmit={onSubmit} className={authCardStackCss}>
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
      <Button variant="primary" size="large" type="submit" isFullWidth isLoading={isSending}>
        {t("password-reset-send-link")}
      </Button>
    </form>
  )
}

interface LinkSentDetailsProps {
  onResend: () => void
  isSending: boolean
  isResent: boolean
  cooldownSeconds: number
  apiError: React.ReactNode
}

const LinkSentDetails: React.FC<LinkSentDetailsProps> = ({
  onResend,
  isSending,
  isResent,
  cooldownSeconds,
  apiError,
}) => {
  const { t } = useTranslation()
  const cooldownNote =
    cooldownSeconds > 0
      ? t("password-reset-send-again-wait", {
          minutes: Math.ceil(cooldownSeconds / secondsInMinute),
        })
      : undefined
  return (
    <>
      <ul className={factsListCss}>
        <li>
          <span className={factIconCss} aria-hidden="true">
            <Clock size={16} />
          </span>
          <span>{t("password-reset-link-valid-for", { count: RESET_LINK_LIFETIME_HOURS })}</span>
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
          isLoading={isSending}
          disabledReason={cooldownNote}
          onPress={onResend}
        >
          {t("password-reset-send-again")}
        </Button>
        {/* Stays mounted so screen readers have registered it before the message appears. */}
        <p className={resendNoteCss} role="status">
          {isResent && t("password-reset-sent-again")}
        </p>
        <p className={resendNoteCss}>{cooldownNote}</p>
      </div>
    </>
  )
}

const ResetPassword: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-reset-password"))
  const uncheckedReturnTo = useQueryParameter("return_to")
  const loginHref = loginRoute(validateReturnToRouteOrDefault(uncheckedReturnTo, "/"))
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [isResent, setIsResent] = useState(false)
  const [cooldownSeconds, startCooldown] = useCooldown(0)
  const altchaRef = useRef<AltchaWidgetHandle>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { control, handleSubmit, setFocus } = useForm<SubmitEmailFormFields>({
    defaultValues: { email: "" },
  })

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
        startCooldown(Date.now() + RESET_EMAIL_RESEND_COOLDOWN_MS)
      },
    },
  )

  const apiError = postResetPassword.isError && (
    // notify:true already announces the error via the toast; the notice is the persistent copy.
    // oxlint-disable-next-line i18next/no-literal-string -- ErrorNotice enum values, not UI text
    <ErrorNotice error={postResetPassword.error} announce="off" density="compact" />
  )

  const returnToEmailForm = () => {
    sendGenerationRef.current += 1
    postResetPassword.reset()
    setIsResent(false)
    setSentEmail(null)
  }

  const resend = (email: string) => {
    setIsResent(false)
    postResetPassword.mutate(
      { email, generation: sendGenerationRef.current },
      { onSuccess: () => setIsResent(true) },
    )
  }

  const {
    content,
    ...cardProps
  }: Pick<AuthCardProps, "title" | "statusIcon" | "lede"> & {
    content: React.ReactNode
  } =
    sentEmail === null
      ? {
          title: t("title-reset-password"),
          lede: t("enter-email-for-password-reset-link"),
          content: (
            <RequestLinkForm
              control={control}
              onSubmit={handleSubmit((data) =>
                postResetPassword.mutate({ ...data, generation: sendGenerationRef.current }),
              )}
              isSending={postResetPassword.isPending}
              apiError={apiError}
            />
          ),
        }
      : {
          title: t("password-reset-check-your-email"),
          // oxlint-disable-next-line i18next/no-literal-string -- AuthCard enum value
          statusIcon: "mail",
          lede: (
            <Trans t={t} i18nKey="password-reset-email-sent-to" values={{ email: sentEmail }} />
          ),
          content: (
            <LinkSentDetails
              onResend={() => resend(sentEmail)}
              isSending={postResetPassword.isPending}
              isResent={isResent}
              cooldownSeconds={cooldownSeconds}
              apiError={apiError}
            />
          ),
        }

  return (
    <AuthCard
      {...cardProps}
      headingRef={headingRef}
      footer={
        <>
          {sentEmail !== null && (
            <AuthCardFooterLink
              prompt={t("password-reset-wrong-address")}
              onPress={returnToEmailForm}
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
      {content}
      {/* Rendered outside both states so its next solve survives the switch to the sent state. */}
      {/* oxlint-disable-next-line i18next/no-literal-string -- API value */}
      <AltchaWidget ref={altchaRef} purpose={"password_reset"} />
    </AuthCard>
  )
}

export default withErrorBoundary(ResetPassword)
