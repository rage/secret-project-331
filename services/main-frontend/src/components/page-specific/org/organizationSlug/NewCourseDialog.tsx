import React from "react"
import { useTranslation } from "react-i18next"

import NewCourseForm from "../../../NewCourseForm"

import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

interface NewCourseDialogProps {
  open: boolean
  onClose: () => void
  organizationId: string
}

const NewCourseDialog: React.FC<NewCourseDialogProps> = ({ open, onClose, organizationId }) => {
  const { t } = useTranslation()

  return (
    <StandardDialog open={open} onClose={onClose} title={t("new-course")}>
      <NewCourseForm
        organizationId={organizationId}
        onSuccess={() => {
          onClose()
        }}
      />
    </StandardDialog>
  )
}

export default NewCourseDialog
