"use client"

import { css } from "@emotion/css"
import i18n from "i18next"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { sendResetPasswordEmail } from "@/generated/api/sdk.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { isBoolean } from "@/shared-module/common/utils/fetching"
import { validateReturnToRouteOrDefault } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, TextField } from "@/shared-module/components"
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
  const { control, handleSubmit, setFocus } = useForm<SubmitEmailFormFields>({
    defaultValues: { email: "" },
  })

  useEffect(() => {
    // oxlint-disable-next-line i18next/no-literal-string
    setFocus("email")
  }, [setFocus])

  const postResetPassword = useToastMutation(
    async (data: SubmitEmailFormFields) =>
      validateGeneratedData(
        await sendResetPasswordEmail({
          body: {
            email: data.email,
            language: i18n.language,
          },
        }),
        isBoolean,
      ),
    { method: "POST", notify: true },
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
        <h3>{t("password-reset-email-sent")}</h3>
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
      <h3
        className={css`
          margin-bottom: 1.5rem;
        `}
      >
        {t("enter-email-for-password-reset-link")}
      </h3>
      {postResetPassword.isError && (
        <ErrorBanner error={postResetPassword.error} variant={"readOnly"} />
      )}

      <form
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
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: t("enter-a-valid-email"),
            },
          }}
        />
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
