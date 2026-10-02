"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

import NewExternalCourseForm from "./NewExternalCourseForm"

interface NewExternalCourseDialogProps {
  open: boolean
  onClose: () => void
}

const NewExternalCourseDialog: React.FC<NewExternalCourseDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation()

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      title={t("new-course")}
      buttons={[
        {
          children: t("button-text-create"),
          variant: "primary",
          // oxlint-disable-next-line i18next/no-literal-string
          form: "new-external-course-form",
        },
      ]}
    >
      <NewExternalCourseForm onSuccess={onClose} />
    </StandardDialog>
  )
}

export default NewExternalCourseDialog
