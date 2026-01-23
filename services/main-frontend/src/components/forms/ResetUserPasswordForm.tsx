"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { postPasswordReset } from "@/services/backend/users"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

type ResetPasswordFormFields = {
  token: string
  new_password: string
  password_confirmation: string
}

type ResetPasswordFormProps = {
  token: string
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ token }) => {
  const { t } = useTranslation()
  const {
    handleSubmit,
    register,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormFields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      token,
    },
  })
  const router = useRouter()

  const newPassword = watch("new_password")

  const postPasswordChangeMutation = useToastMutation<boolean, unknown, ResetPasswordFormFields>(
    async (data) => {
      const { token, new_password } = data
      const result = await postPasswordReset(token, new_password)
      return result
    },
    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: () => {
        // eslint-disable-next-line i18next/no-literal-string
        router.push("/login?return_to=%2F")
      },
    },
  )

  return (
    <div>
      <h1>{t("confirm-your-new-password")}</h1>

      <form onSubmit={handleSubmit((data) => postPasswordChangeMutation.mutate(data))}>
        <TextField
          label={t("password")}
          type="password"
          placeholder={t("enter-your-password")}
          {...register("new_password", {
            required: t("required-field"),
            minLength: {
              value: 8,
              message: t("password-must-have-at-least-8-characters"),
            },
          })}
          error={errors.new_password?.message}
          required
        />

        <TextField
          label={t("confirm-password")}
          type="password"
          placeholder={t("confirm-your-password")}
          {...register("password_confirmation", {
            required: t("required-field"),
            validate: (value) => value === newPassword || t("passwords-dont-match"),
          })}
          error={errors.password_confirmation?.message}
          required
        />

        <input type="hidden" value={token} {...register("token")} />

        <Button type="submit" variant="primary" size={"small"}>
          {t("submit")}
        </Button>
      </form>
    </div>
  )
}

export default ResetPasswordForm
