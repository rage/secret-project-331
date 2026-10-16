"use client"

import React, { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import NewCourseForm, { type NewCourseFormHandle } from "@/components/NewCourseForm"
import { Dialog } from "@/shared-module/components"

interface NewCourseLanguageVersionDialogProps {
  showNewLanguageVersionForm: boolean
  courseName: string
  organizationId: string
  onSuccess: () => void
  onClose: () => void
  courseId: string
}

const NewCourseLanguageVersionDialog: React.FC<
  React.PropsWithChildren<NewCourseLanguageVersionDialogProps>
> = ({ showNewLanguageVersionForm, courseName, onSuccess, onClose, organizationId, courseId }) => {
  const { t } = useTranslation()
  const formRef = useRef<NewCourseFormHandle>(null)
  const [isPending, setIsPending] = useState(false)

  return (
    <Dialog
      open={showNewLanguageVersionForm}
      onClose={onClose}
      title={t("create-new-language-version-of", { "course-name": courseName })}
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
        courseId={courseId}
        isLanguageVersion={true}
        hideSubmitButton
        onPendingChange={setIsPending}
        onSuccess={onSuccess}
      />
    </Dialog>
  )
}

export default NewCourseLanguageVersionDialog
