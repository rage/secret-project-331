import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { USER_ROLES } from "@/constants/roles"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

type RoleValue = (typeof USER_ROLES)[number]["value"]

type AddUserForm = {
  email: string
  role: RoleValue
}

interface AddUserPopupProps {
  show: boolean
  onClose: () => void
  onSave: (data: AddUserForm) => void
}

const AddUserPopup: React.FC<AddUserPopupProps> = ({ show, onClose, onSave }) => {
  const { t } = useTranslation("main-frontend")
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AddUserForm>({
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
    <StandardDialog
      open={show}
      onClose={onClose}
      title={t("add-user-title")}
      buttons={[
        {
          children: t("save"),
          onClick: submitForm,
          variant: "primary",
        },
        {
          children: t("button-text-cancel"),
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
            {...register("email", { required: true })}
            id="add-user-email"
            label={t("label-email")}
            error={errors.email ? t("validation-required") : undefined}
          />
        </div>

        <div
          className={css`
            flex: 1;
            min-width: 0;
          `}
        >
          <SelectField
            {...register("role", { required: true })}
            id="add-user-role"
            label={t("label-role")}
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
    </StandardDialog>
  )
}

export default AddUserPopup
