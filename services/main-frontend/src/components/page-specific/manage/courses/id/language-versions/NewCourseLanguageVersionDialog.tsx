import { useTranslation } from "react-i18next"

import NewCourseForm from "../../../../../forms/NewCourseForm"

import { NewCourse } from "@/shared-module/common/bindings"
import StandardDialog from "@/shared-module/common/components/StandardDialog"

interface NewCourseLanguageVersionDialogProps {
  showNewLanguageVersionForm: boolean
  courseName: string
  organizationId: string
  handleSubmit: (newCourse: NewCourse) => Promise<void>
  onClose: () => void
  courseId: string
}

const NewCourseLanguageVersionDialog: React.FC<
  React.PropsWithChildren<NewCourseLanguageVersionDialogProps>
> = ({ showNewLanguageVersionForm, courseName, handleSubmit, onClose, organizationId }) => {
  const { t } = useTranslation()
  return (
    <StandardDialog
      open={showNewLanguageVersionForm}
      onClose={onClose}
      title={t("create-new-language-version-of", { "course-name": courseName })}
    >
      <NewCourseForm
        organizationId={organizationId}
        onSubmitNewCourseForm={handleSubmit}
        onClose={onClose}
      />
    </StandardDialog>
  )
}

export default NewCourseLanguageVersionDialog
