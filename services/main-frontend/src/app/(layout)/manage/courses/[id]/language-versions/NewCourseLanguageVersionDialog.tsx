"use client"

import { useTranslation } from "react-i18next"

import NewCourseForm from "@/components/NewCourseForm"
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
  return (
    <Dialog
      open={showNewLanguageVersionForm}
      onClose={onClose}
      title={t("create-new-language-version-of", { "course-name": courseName })}
    >
      <NewCourseForm
        organizationId={organizationId}
        courseId={courseId}
        isLanguageVersion={true}
        onSuccess={onSuccess}
      />
    </Dialog>
  )
}

export default NewCourseLanguageVersionDialog
