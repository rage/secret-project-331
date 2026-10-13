"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { Dialog } from "@/shared-module/components"

import NewExternalCourseForm from "./NewExternalCourseForm"

interface NewExternalCourseDialogProps {
  open: boolean
  onClose: () => void
}

const NewExternalCourseDialog: React.FC<NewExternalCourseDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("new-course")}
      actions={[
        {
          label: t("button-text-create"),
          variant: "primary",
          type: "submit",
          // oxlint-disable-next-line i18next/no-literal-string
          domProps: { form: "new-external-course-form" },
        },
      ]}
    >
      <NewExternalCourseForm onSuccess={onClose} />
    </Dialog>
  )
}

export default NewExternalCourseDialog
