import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { USER_ROLES } from "@/constants/roles"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface AddUserPopupProps {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  email: string
  setEmail: React.Dispatch<React.SetStateAction<string>>
  role: string
  setRole: React.Dispatch<React.SetStateAction<string>>
  handleSave: () => void
}

const AddUserPopup: React.FC<AddUserPopupProps> = ({
  show,
  setShow,
  email,
  setEmail,
  role,
  setRole,
  handleSave,
}) => {
  const { t } = useTranslation("main-frontend") as { t: (key: string) => string }

  return (
    <StandardDialog
      open={show}
      onClose={() => setShow(false)}
      title={t("add-user-title")}
      buttons={[
        {
          children: t("save"),
          onClick: handleSave,

          variant: "primary",
        },
        {
          children: t("button-text-cancel"),
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
        {t("add-user-description")}
      </p>

      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-bottom: 32px;

          ${respondToOrLarger.lg} {
            flex-direction: row;
          }
        `}
      >
        {/* Email */}
        <div
          className={css`
            flex: 1;
            display: flex;
            flex-direction: column;
          `}
        >
          <label htmlFor="add-user-email">{t("label-email")}</label>
          <input
            id="add-user-email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={css`
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              padding: 8px 12px;
              font-size: 14px;
            `}
          />
        </div>

        {/* Role */}
        <div
          className={css`
            flex: 1;
            display: flex;
            flex-direction: column;
          `}
        >
          <label htmlFor="add-user-role">{t("label-role")}</label>
          <select
            id="add-user-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={css`
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              padding: 8px 12px;
              font-size: 14px;
              background-color: white;
            `}
          >
            <option value="">{t("button-select-role")}</option>
            {USER_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {t(role.translationKey)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </StandardDialog>
  )
}

export default AddUserPopup
