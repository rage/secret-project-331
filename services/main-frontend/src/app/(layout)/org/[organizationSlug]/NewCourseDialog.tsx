"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import NewCourseForm from "@/components/NewCourseForm"
import { Dialog } from "@/shared-module/components"

interface NewCourseDialogProps {
  open: boolean
  onClose: () => void
  organizationId: string
}

const NewCourseDialog: React.FC<NewCourseDialogProps> = ({ open, onClose, organizationId }) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} title={t("new-course")}>
      <NewCourseForm
        organizationId={organizationId}
        onSuccess={() => {
          onClose()
        }}
      />
    </Dialog>
  )
}

export default NewCourseDialog
