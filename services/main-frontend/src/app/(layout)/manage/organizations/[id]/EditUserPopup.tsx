"use client"

import { css } from "@emotion/css"
import React, { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { USER_ROLES } from "@/constants/roles"
import { Dialog, Select } from "@/shared-module/components"

interface EditUserPopupProps {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  name: string
  email: string
  role: string
  setRole: React.Dispatch<React.SetStateAction<string>>
  handleSave: () => void
}

interface EditUserRoleFormValues {
  role: string
}

const ROLE_FIELD_NAME = "role" as const

/**
 * Dialog for changing one user's role in an organization.
 *
 * The role lives in the parent's state, not in a form, so a local form mirrors it in both
 * directions to satisfy `components`' react-hook-form-only `Select`.
 */
const EditUserPopup: React.FC<EditUserPopupProps> = ({
  show,
  setShow,
  name,
  email,
  role,
  setRole,
  handleSave,
}) => {
  const { t } = useTranslation()
  const { control } = useForm<EditUserRoleFormValues>({ values: { role } })
  const selectedRole = useWatch({ control, name: ROLE_FIELD_NAME })

  // Echoing the parent's own value back at it is safe only because setRole is a plain state
  // setter: an unchanged write bails out instead of looping.
  useEffect(() => {
    setRole(selectedRole)
  }, [selectedRole, setRole])

  return (
    <Dialog
      open={show}
      onClose={() => setShow(false)}
      title={t("edit-user-role")}
      actions={[
        {
          label: t("save"),
          onClick: handleSave,
          variant: "primary",
        },
        {
          label: t("button-text-cancel"),
          onClick: () => setShow(false),
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
        {t("edit-user-description")}
      </p>

      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-bottom: 32px;
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 12px;
          `}
        >
          <label
            className={css`
              font-size: 14px;
              width: 60px;
            `}
          >
            {t("label-name")}
          </label>
          <span
            className={css`
              font-size: 14px;
              overflow-wrap: anywhere;
            `}
          >
            {name}
          </span>
        </div>

        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 12px;
          `}
        >
          <label
            className={css`
              font-size: 14px;
              width: 60px;
            `}
          >
            {t("label-email")}
          </label>
          <span
            className={css`
              font-size: 14px;
              overflow-wrap: anywhere;
            `}
          >
            {email}
          </span>
        </div>

        <Select
          name={ROLE_FIELD_NAME}
          control={control}
          id="edit-user-role"
          label={t("label-role")}
          options={USER_ROLES.map((roleOption) => ({
            value: roleOption.value,
            label: t(roleOption.translationKey),
          }))}
        />
      </div>
    </Dialog>
  )
}

export default EditUserPopup
