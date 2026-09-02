"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { Dialog } from "@/shared-module/components"

interface Props {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  handleDelete: () => void
}

const DeleteOrganizationPopup: React.FC<Props> = ({ show, setShow, handleDelete }) => {
  const { t } = useTranslation()
  const [confirmText, setConfirmText] = useState("")

  return (
    <Dialog
      open={show}
      onClose={() => {
        setShow(false)
        setConfirmText("")
      }}
      title={t("delete-organization")}
      actions={[
        {
          label: t("confirm"),
          onClick: () => {
            handleDelete()
            setShow(false)
            setConfirmText("")
          },
          variant: "primary",
          disabled: confirmText !== "delete",
        },
        {
          label: t("button-text-cancel"),
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
    </Dialog>
  )
}

export default DeleteOrganizationPopup
