"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

interface Props {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  handleDelete: () => void
}

const DeleteOrganizationPopup: React.FC<Props> = ({ show, setShow, handleDelete }) => {
  const { t } = useTranslation()
  const [confirmText, setConfirmText] = useState("")

  return (
    <StandardDialog
      open={show}
      onClose={() => {
        setShow(false)
        setConfirmText("")
      }}
      title={t("delete-organization")}
      buttons={[
        {
          children: t("confirm"),
          onClick: () => {
            handleDelete()
            setShow(false)
            setConfirmText("")
          },

          variant: "primary",
          disabled: confirmText !== "delete",
        },
        {
          children: t("button-text-cancel"),
          onClick: () => {
            setShow(false)
            setConfirmText("")
          },

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
        {t("confirm-organization-deletion")}
      </p>

      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className={css`
          border: 1.6px solid #e4e5e8;
          border-radius: 2px;
          padding: 8px 12px;
          font-size: 14px;
          width: 100%;
        `}
      />
    </StandardDialog>
  )
}

export default DeleteOrganizationPopup
