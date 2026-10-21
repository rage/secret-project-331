"use client"

import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Dialog, TextField } from "@/shared-module/components"

interface Props {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  handleDelete: () => void
}

const DeleteOrganizationPopup: React.FC<Props> = ({ show, setShow, handleDelete }) => {
  const { t } = useTranslation()
  const { control, watch, reset } = useForm<{ confirmText: string }>({
    defaultValues: { confirmText: "" },
  })
  const confirmText = watch("confirmText")

  const close = () => {
    setShow(false)
    reset()
  }

  return (
    <Dialog
      open={show}
      onClose={close}
      title={t("delete-organization")}
      actions={[
        {
          label: t("confirm"),
          onClick: () => {
            handleDelete()
            close()
          },
          variant: "primary",
          disabled: confirmText !== "delete",
        },
        {
          label: t("button-text-cancel"),
          onClick: close,
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
      <TextField
        name="confirmText"
        control={control}
        label={t("confirm-organization-deletion")}
        isLabelHidden
      />
    </Dialog>
  )
}

export default DeleteOrganizationPopup
