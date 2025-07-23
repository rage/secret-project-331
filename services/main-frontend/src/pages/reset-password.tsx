/* eslint-disable i18next/no-literal-string */
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { sendResetPasswordLink } from "@/services/backend/users"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

type SubmitEmailFormFields = {
  email: string
}
const ResetPassword: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()

  const {
    handleSubmit,
    formState: { errors },
    register,
  } = useForm<SubmitEmailFormFields>()

  const postResetPassword = useToastMutation(
    (data: SubmitEmailFormFields) => sendResetPasswordLink(data.email),
    { method: "POST", notify: true },
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
          {t("button-text-save")}
        </Button>
      </form>
    </>
  )
}

export default withErrorBoundary(ResetPassword)
