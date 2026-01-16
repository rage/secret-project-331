"use client"

import { css } from "@emotion/css"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { postPasswordChange } from "@/services/backend/users"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

type ChangePasswordFormFields = {
  current_password: string
  new_password: string
  password_confirmation: string
}

const ChangeUserPasswordForm: React.FC = () => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const {
    handleSubmit,
    register,
    reset,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordFormFields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      current_password: "",
      new_password: "",
      password_confirmation: "",
    },
  })
  const newPassword = watch("new_password")

  const changePasswordMutation = useToastMutation<boolean, unknown, ChangePasswordFormFields>(
    async (data) => {
      const response = await postPasswordChange(data.current_password, data.new_password)
      return response
    },
    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: () => {
        setIsOpen(false)
        reset()
      },
    },
  )

  const onSubmit = (data: ChangePasswordFormFields) => {
    changePasswordMutation.mutate(data)
  }

  const handleCancel = () => {
    reset()
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <div>
        <Button
          data-testid="change-password-button"
          variant="primary"
          size="small"
          onClick={() => setIsOpen(true)}
        >
          {t("change-password")}
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={css`
        display: flex;
        flex-direction: column;
      `}
    >
      <TextField
        label={t("old-password")}
        type="password"
        placeholder={t("enter-your-current-password")}
        {...register("current_password", { required: t("required-field") })}
        error={errors.current_password?.message}
        required
      />

      <TextField
        label={t("new-password")}
        type="password"
        placeholder={t("enter-your-new-password")}
        {...register("new_password", {
          required: t("required-field"),
          minLength: { value: 8, message: t("password-must-have-at-least-8-characters") },
        })}
        error={errors.new_password?.message}
        required
      />

      <TextField
        label={t("confirm-new-password")}
        type="password"
        placeholder={t("confirm-your-new-password")}
        {...register("password_confirmation", {
          required: t("required-field"),
          validate: (value) => value === newPassword || t("passwords-dont-match"),
        })}
        error={errors.password_confirmation?.message}
        required
      />

      <div
        className={css`
          display: flex;
          gap: 10px;
        `}
      >
        <Button
          type="submit"
          disabled={changePasswordMutation.isPending}
          variant={"primary"}
          size={"small"}
        >
          {t("button-text-save")}
        </Button>
        <Button type="button" variant="secondary" onClick={handleCancel} size={"small"}>
          {t("button-text-cancel")}
        </Button>
      </div>
    </form>
  )
}

export default ChangeUserPasswordForm
