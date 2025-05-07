import { useTranslation } from "react-i18next"

import NewCourseForm from "../../../../../forms/NewCourseForm"

import StandardDialog from "@/shared-module/common/components/StandardDialog"

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
    <StandardDialog
      open={showNewLanguageVersionForm}
      onClose={onClose}
      title={t("create-new-language-version-of", { "course-name": courseName })}
    >
      <NewCourseForm
        organizationId={organizationId}
        courseId={courseId}
        isLanguageVersion={true}
        onSuccess={onSuccess}
        onClose={onClose}
      />
    </StandardDialog>
  )
}

export default NewCourseLanguageVersionDialog
