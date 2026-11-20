"use client"

import { css } from "@emotion/css"
import i18n from "i18next"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import AltchaWidget, { type AltchaWidgetHandle } from "@/components/forms/AltchaWidget"
import TooManyAttemptsNotice, { isTooManyAttempts } from "@/components/forms/TooManyAttemptsNotice"
import { sendResetPasswordEmail } from "@/generated/api/sdk.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { isBoolean } from "@/shared-module/common/utils/fetching"
import { validateReturnToRouteOrDefault } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import { EMAIL_PATTERN } from "@/shared-module/common/utils/validation"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, TextField, ErrorNotice } from "@/shared-module/components"
import { validateGeneratedData } from "@/utils/validateGeneratedData"

interface SubmitEmailFormFields {
  email: string
}
const ResetPassword: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-reset-password"))
  const router = useRouter()
  const uncheckedReturnTo = useQueryParameter("return_to")
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState<string>("")
  const altchaRef = useRef<AltchaWidgetHandle>(null)
  const { control, handleSubmit, setFocus } = useForm<SubmitEmailFormFields>({
    defaultValues: { email: "" },
  })

  useEffect(() => {
    // oxlint-disable-next-line i18next/no-literal-string
    setFocus("email")
  }, [setFocus])

  const postResetPassword = useToastMutation(
    async (data: SubmitEmailFormFields) => {
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
    { method: "POST", notify: true, isErrorHandledByCaller: isTooManyAttempts },
    {
      onSuccess: (_, variables) => {
        setSentEmail(variables.email)
        setEmailSent(true)
      },
    },
  )

  if (emailSent) {
    return (
      <>
        <h1>{t("password-reset-email-sent")}</h1>
        <p>{t("password-reset-email-sent-description", { email: sentEmail })}</p>
        <Button
          variant="primary"
          size="medium"
          onClick={() => {
            const returnTo = validateReturnToRouteOrDefault(uncheckedReturnTo, "/")
            router.push(returnTo)
          }}
        >
          {t("button-text-back")}
        </Button>
      </>
    )
  }

  return (
    <>
      <h1>{t("title-reset-password")}</h1>
      <p
        className={css`
          margin-bottom: 1.5rem;
        `}
      >
        {t("enter-email-for-password-reset-link")}
      </p>
      {/* notify:true already announces this error via the toast; the banner is just the persistent copy */}
      {postResetPassword.isError &&
        (isTooManyAttempts(postResetPassword.error) ? (
          <TooManyAttemptsNotice error={postResetPassword.error} />
        ) : (
          // oxlint-disable-next-line i18next/no-literal-string -- "off" is an ErrorNoticeAnnouncement enum value, not UI text
          <ErrorNotice error={postResetPassword.error} announce="off" />
        ))}

      <form
        noValidate
        onSubmit={handleSubmit((data) => postResetPassword.mutate(data))}
        className={css`
          display: flex;
          flex-direction: column;
          gap: 1rem;
        `}
      >
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
        {/* oxlint-disable-next-line i18next/no-literal-string -- API value */}
        <AltchaWidget ref={altchaRef} purpose={"password_reset"} />
        <div
          className={css`
            display: flex;
            gap: 0.75rem;
          `}
        >
          <Button
            variant="primary"
            size="medium"
            type="submit"
            isLoading={postResetPassword.isPending}
          >
            {t("button-text-send")}
          </Button>
          <Button
            variant="secondary"
            size="medium"
            type="button"
            onClick={() => {
              const returnTo = validateReturnToRouteOrDefault(uncheckedReturnTo, "/")
              router.push(returnTo)
            }}
          >
            {t("button-text-cancel")}
          </Button>
        </div>
      </form>
    </>
  )
}

export default withErrorBoundary(ResetPassword)
