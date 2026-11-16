"use client"

import { css } from "@emotion/css"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { changeUserPassword } from "@/generated/api/sdk.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { isBoolean } from "@/shared-module/common/utils/fetching"
import { Button, TextField } from "@/shared-module/components"
import { validateGeneratedData } from "@/utils/validateGeneratedData"

interface ChangePasswordFormFields {
  current_password: string
  new_password: string
  password_confirmation: string
}

class WrongCurrentPasswordError extends Error {}

const ChangeUserPasswordForm: React.FC = () => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef(false)

  const { handleSubmit, control, reset, watch, setError, setFocus } =
    useForm<ChangePasswordFormFields>({
      // oxlint-disable-next-line i18next/no-literal-string
      mode: "onChange",
      defaultValues: {
        current_password: "",
        new_password: "",
        password_confirmation: "",
      },
    })
  const newPassword = watch("new_password")

  useEffect(() => {
    if (isOpen) {
      // oxlint-disable-next-line i18next/no-literal-string
      setFocus("current_password")
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false
      openButtonRef.current?.focus()
    }
  }, [isOpen, setFocus])

  const changePasswordMutation = useToastMutation<boolean, unknown, ChangePasswordFormFields>(
    async (data) => {
      const changed = validateGeneratedData(
        await changeUserPassword({
          body: {
            old_password: data.current_password,
            new_password: data.new_password,
          },
        }),
        isBoolean,
      )
      // The API answers 200 false when the current password is wrong.
      if (!changed) {
        throw new WrongCurrentPasswordError()
      }
      return changed
    },
    {
      method: "POST",
      notify: true,
      isErrorHandledByCaller: (error) => error instanceof WrongCurrentPasswordError,
    },
    {
      onSuccess: () => {
        restoreFocusRef.current = true
        setIsOpen(false)
        reset()
      },
      onError: (error) => {
        if (error instanceof WrongCurrentPasswordError) {
          setError("current_password", { type: "server", message: t("current-password-incorrect") })
          // oxlint-disable-next-line i18next/no-literal-string
          setFocus("current_password")
        }
      },
    },
  )

  const onSubmit = (data: ChangePasswordFormFields) => {
    changePasswordMutation.mutate(data)
  }

  const handleCancel = () => {
    restoreFocusRef.current = true
    reset()
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <div>
        <Button
          ref={openButtonRef}
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
        gap: var(--space-4);
      `}
    >
      <TextField
        name="current_password"
        control={control}
        label={t("old-password")}
        type="password"
        autoComplete="current-password"
        rules={{ required: t("required-field") }}
        isRequired
      />

      <TextField
        name="new_password"
        control={control}
        label={t("new-password")}
        description={t("password-must-have-at-least-8-characters")}
        type="password"
        autoComplete="new-password"
        rules={{
          required: t("required-field"),
          minLength: { value: 8, message: t("password-must-have-at-least-8-characters") },
        }}
        isRequired
      />

      <TextField
        name="password_confirmation"
        control={control}
        label={t("confirm-new-password")}
        type="password"
        autoComplete="new-password"
        rules={{
          required: t("required-field"),
          validate: (value) => value === newPassword || t("passwords-dont-match"),
        }}
        isRequired
      />

      <div
        className={css`
          display: flex;
          gap: 10px;
        `}
      >
        <Button type="submit" disabled={changePasswordMutation.isPending} variant={"primary"}>
          {t("button-text-save")}
        </Button>
        <Button type="button" variant="secondary" onClick={handleCancel}>
          {t("button-text-cancel")}
        </Button>
      </div>
    </form>
  )
}

export default ChangeUserPasswordForm
