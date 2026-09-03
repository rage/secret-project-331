"use client"

import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { USER_ROLES } from "@/constants/roles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { Dialog, Select, TextField } from "@/shared-module/components"

type RoleValue = (typeof USER_ROLES)[number]["value"]

interface AddUserForm {
  email: string
  role: RoleValue
}

interface AddUserPopupProps {
  show: boolean
  onClose: () => void
  onSave: (data: AddUserForm) => void
}

const AddUserPopup: React.FC<AddUserPopupProps> = ({ show, onClose, onSave }) => {
  const { t } = useTranslation()
  const { control, handleSubmit, reset } = useForm<AddUserForm>({
    defaultValues: {
      email: "",
      role: "",
    },
  })

  React.useEffect(() => {
    if (!show) {
      reset()
    }
  }, [show, reset])

  const submitForm = handleSubmit((data) => {
    onSave(data)
    onClose()
    reset()
  })

  return (
    <Dialog
      open={show}
      onClose={onClose}
      title={t("add-user-title")}
      actions={[
        {
          label: t("save"),
          onClick: submitForm,
          variant: "primary",
        },
        {
          label: t("button-text-cancel"),
          onClick: onClose,
          variant: "secondary",
        },
      ]}
    >
      <p
        className={css`
          font-size: 16px;
          margin-bottom: 32px;
        `}
      >
        {t("add-user-description")}
      </p>

      <form
        onSubmit={submitForm}
        className={css`
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-bottom: 32px;
          width: 100%;

          ${respondToOrLarger.lg} {
            flex-direction: row;
          }
        `}
      >
        <div
          className={css`
            flex: 1;
            min-width: 0;
          `}
        >
          <TextField
            name="email"
            control={control}
            id="add-user-email"
            label={t("label-email")}
            rules={{ required: t("validation-required") }}
          />
        </div>

        <div
          className={css`
            flex: 1;
            min-width: 0;
          `}
        >
          <Select
            name="role"
            control={control}
            id="add-user-role"
            label={t("label-role")}
            rules={{ required: t("validation-required") }}
            options={[
              { value: "", label: t("button-select-role") },
              ...USER_ROLES.map((role) => ({
                value: role.value,
                label: role.value,
              })),
            ]}
          />
        </div>
      </form>
    </Dialog>
  )
}

export default AddUserPopup
