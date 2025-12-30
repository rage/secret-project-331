"use client"

import i18n from "i18next"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { sendResetPasswordLink } from "@/services/backend/users"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import Spinner from "@/shared-module/common/components/Spinner"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { validateReturnToRouteOrDefault } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

type SubmitEmailFormFields = {
  email: string
}
const ResetPassword: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const uncheckedReturnTo = useQueryParameter("return_to")
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState<string>("")
  const {
    handleSubmit,
    formState: { errors },
    register,
  } = useForm<SubmitEmailFormFields>()

  const postResetPassword = useToastMutation(
    (data: SubmitEmailFormFields) => sendResetPasswordLink(data.email, i18n.language),
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
      <h3>{t("enter-email-for-password-reset-link")}</h3>
      {postResetPassword.isError && (
        <ErrorBanner error={postResetPassword.error} variant={"readOnly"} />
      )}
      {postResetPassword.isPending && <Spinner />}

      <form onSubmit={handleSubmit((data) => postResetPassword.mutate(data))}>
        <TextField
          label={t("email")}
          placeholder={t("email")}
          {...register("email", {
            required: t("required-field"),
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: t("enter-a-valid-email"),
            },
          })}
          required
          error={errors.email}
        />
        <Button
          variant="primary"
          size="medium"
          type="submit"
          disabled={postResetPassword.isPending}
        >
          {t("button-text-send")}
        </Button>
        <Button
          variant="primary"
          size="medium"
          type="button"
          onClick={() => {
            const returnTo = validateReturnToRouteOrDefault(uncheckedReturnTo, "/")
            router.push(returnTo)
          }}
        >
          {t("button-text-cancel")}
        </Button>
      </form>
    </>
  )
}

export default withErrorBoundary(ResetPassword)
