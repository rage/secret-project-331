"use client"

import { css } from "@emotion/css"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import PasswordField from "@/components/forms/PasswordField"
import { resetUserPassword } from "@/generated/api/sdk.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { isBoolean } from "@/shared-module/common/utils/fetching"
import { Button } from "@/shared-module/components"
import { validateGeneratedData } from "@/utils/validateGeneratedData"

interface ResetPasswordFormFields {
  new_password: string
  password_confirmation: string
}

interface ResetPasswordFormProps {
  token: string
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ token }) => {
  const { t } = useTranslation()
  const { control, handleSubmit, watch } = useForm<ResetPasswordFormFields>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      new_password: "",
      password_confirmation: "",
    },
  })
  const router = useRouter()

  const newPassword = watch("new_password")

  const postPasswordChangeMutation = useToastMutation<boolean, unknown, ResetPasswordFormFields>(
    async (data) => {
      const { new_password } = data
      return validateGeneratedData(
        await resetUserPassword({
          body: {
            token,
            new_password,
          },
        }),
        isBoolean,
      )
    },
    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: () => {
        // oxlint-disable-next-line i18next/no-literal-string
        router.push("/login?return_to=%2F")
      },
    },
  )

  return (
    <div>
      <h1>{t("confirm-your-new-password")}</h1>

      <form
        onSubmit={handleSubmit((data) => postPasswordChangeMutation.mutate(data))}
        className={css`
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-width: 420px;
        `}
      >
        <PasswordField
          name="new_password"
          control={control}
          label={t("password")}
          autoComplete="new-password"
          isRequired
          rules={{
            required: t("required-field"),
            minLength: {
              value: 8,
              message: t("password-must-have-at-least-8-characters"),
            },
          }}
        />

        <PasswordField
          name="password_confirmation"
          control={control}
          label={t("confirm-password")}
          autoComplete="new-password"
          isRequired
          rules={{
            required: t("required-field"),
            validate: (value: string) => value === newPassword || t("passwords-dont-match"),
          }}
        />

        <Button
          type="submit"
          variant="primary"
          size="medium"
          isLoading={postPasswordChangeMutation.isPending}
        >
          {t("submit")}
        </Button>
      </form>
    </div>
  )
}

export default ResetPasswordForm
