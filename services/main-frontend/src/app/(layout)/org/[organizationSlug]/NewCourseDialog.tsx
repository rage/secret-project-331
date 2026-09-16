"use client"

import React, { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import NewCourseForm, { type NewCourseFormHandle } from "@/components/NewCourseForm"
import { Dialog } from "@/shared-module/components"

interface NewCourseDialogProps {
  open: boolean
  onClose: () => void
  organizationId: string
}

const NewCourseDialog: React.FC<NewCourseDialogProps> = ({ open, onClose, organizationId }) => {
  const { t } = useTranslation()
  const formRef = useRef<NewCourseFormHandle>(null)
  const [isPending, setIsPending] = useState(false)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("new-course")}
      actions={[
        {
          label: t("button-text-create"),
          variant: "primary",
          disabled: isPending,
          onPress: () => formRef.current?.submit(),
        },
      ]}
    >
      <NewCourseForm
        ref={formRef}
        organizationId={organizationId}
        hideSubmitButton
        onPendingChange={setIsPending}
        onSuccess={() => {
          onClose()
        }}
      />
    </Dialog>
  )
}

export default NewCourseDialog
