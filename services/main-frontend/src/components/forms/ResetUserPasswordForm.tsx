"use client"

import { css } from "@emotion/css"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { AuthCard } from "@/components/auth/AuthCard"
import ResetLinkInvalidCard from "@/components/auth/ResetLinkInvalidCard"
import { PasswordField } from "@/components/forms/PasswordField"
import { resetUserPassword } from "@/generated/api/sdk.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { isBoolean } from "@/shared-module/common/utils/fetching"
import { loginRoute } from "@/shared-module/common/utils/routes"
import { Button, ErrorNotice, focusProgrammatically, Link } from "@/shared-module/components"
import { validateGeneratedData } from "@/utils/validateGeneratedData"

interface ResetPasswordFormFields {
  new_password: string
  password_confirmation: string
}

interface ResetPasswordFormProps {
  token: string
}

const formCss = css`
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
`

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
  /** null until the API answers; false when the token stopped working after the page loaded. */
  const [isPasswordChanged, setIsPasswordChanged] = useState<boolean | null>(null)
  const outcomeHeadingRef = useRef<HTMLHeadingElement>(null)

  const newPassword = watch("new_password")

  useEffect(() => {
    if (isPasswordChanged !== null && outcomeHeadingRef.current) {
      return focusProgrammatically(outcomeHeadingRef.current)
    }
    return undefined
  }, [isPasswordChanged])

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
    // The outcome cards confirm success, and a toast would also say "Success" when the API returns false.
    { notify: false },
    { onSuccess: setIsPasswordChanged },
  )

  if (isPasswordChanged === false) {
    return <ResetLinkInvalidCard headingRef={outcomeHeadingRef} />
  }

  if (isPasswordChanged === true) {
    return (
      <AuthCard
        headingRef={outcomeHeadingRef}
        title={t("password-changed-title")}
        // oxlint-disable-next-line i18next/no-literal-string -- AuthCard enum value
        statusIcon="success"
        lede={t("password-changed-description")}
      >
        <Link href={loginRoute("/")} styledAsButton variant="primary" isFullWidth>
          {t("login")}
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t("password-reset-choose-new-password")}>
      <form
        onSubmit={handleSubmit((data) => postPasswordChangeMutation.mutate(data))}
        className={formCss}
      >
        {postPasswordChangeMutation.isError && (
          // oxlint-disable-next-line i18next/no-literal-string -- ErrorNotice enum value, not UI text
          <ErrorNotice error={postPasswordChangeMutation.error} density="compact" />
        )}
        <PasswordField
          name="new_password"
          control={control}
          label={t("new-password")}
          description={t("password-reset-new-password-hint")}
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
          label={t("confirm-new-password")}
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
          isFullWidth
          isLoading={postPasswordChangeMutation.isPending}
        >
          {t("change-password")}
        </Button>
      </form>
    </AuthCard>
  )
}

export default ResetPasswordForm
