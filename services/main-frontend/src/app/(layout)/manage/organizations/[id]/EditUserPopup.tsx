"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { USER_ROLES } from "@/constants/roles"
import { Dialog } from "@/shared-module/components"

interface EditUserPopupProps {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  name: string
  email: string
  role: string
  setRole: React.Dispatch<React.SetStateAction<string>>
  handleSave: () => void
}

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
        {/* Name Row */}
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

        {/* Email Row */}
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

        {/* Role */}
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 12px;
          `}
        >
          <label
            htmlFor="edit-user-role"
            className={css`
              font-size: 14px;
              width: 60px;
            `}
          >
            {t("label-role")}
          </label>
          <select
            id="edit-user-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={css`
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              padding: 8px 12px;
              font-size: 14px;
              width: 100%;
              background-color: white;
            `}
          >
            {USER_ROLES.map((roleOption) => (
              <option key={roleOption.value} value={roleOption.value}>
                {t(roleOption.translationKey)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Dialog>
  )
}

export default EditUserPopup
