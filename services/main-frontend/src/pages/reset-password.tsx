/* eslint-disable i18next/no-literal-string */
import i18n from "i18next"
import { useRouter } from "next/router"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { sendResetPasswordLink } from "@/services/backend/users"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { validateReturnToRouteOrDefault } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

type SubmitEmailFormFields = {
  email: string
  language: string
}
const ResetPassword: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const uncheckedReturnTo = useQueryParameter("return_to")
  const {
    handleSubmit,
    formState: { errors },
    register,
  } = useForm<SubmitEmailFormFields>()

  const postResetPassword = useToastMutation(
    (data: SubmitEmailFormFields) => sendResetPasswordLink(data.email, i18n.language),
    { method: "POST", notify: true },
    {
      onSuccess: () => {
        router.push("/")
      },
    },
  )

  return (
    <>
      <h3>Enter your email and we will send you a link to reset your password</h3>
      <form onSubmit={handleSubmit((data) => postResetPassword.mutate(data))}>
        <TextField
          label={t("email")}
          placeholder={t("email")}
          {...register("email", {
            required: t("required-field"),
            validate: {
              isValidEmail: (value) =>
                value.split("").indexOf("@") !== -1 || t("enter-a-valid-email"),
            },
          })}
          required
          error={errors.email}
        />
        <Button variant="primary" size="medium" type="submit">
          {t("button-text-send")}
        </Button>
        <Button
          variant="primary"
          size="medium"
          type="submit"
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
