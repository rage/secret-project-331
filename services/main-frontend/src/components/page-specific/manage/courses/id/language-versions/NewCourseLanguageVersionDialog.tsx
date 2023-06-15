import { css } from "@emotion/css"
import { Dialog } from "@mui/material"
import { useTranslation } from "react-i18next"

import { NewCourse } from "../../../../../../shared-module/bindings"
import NewCourseForm from "../../../../../forms/NewCourseForm"

interface NewCourseLanguageVersionDialogProps {
  showNewLanguageVersionForm: boolean
  courseName: string
  organizationId: string
  handleSubmit: (newCourse: NewCourse, copyUserPermissions: boolean) => Promise<void>
  onClose: () => void
  courseId: string
}

const NewCourseLanguageVersionDialog: React.FC<
  React.PropsWithChildren<NewCourseLanguageVersionDialogProps>
> = ({ showNewLanguageVersionForm, courseName, handleSubmit, onClose, organizationId }) => {
  const { t } = useTranslation()
  return (
    <Dialog open={showNewLanguageVersionForm} onClose={onClose}>
      <div
        className={css`
          margin: 1rem;
        `}
      >
        <div>{t("create-new-language-version-of", { "course-name": courseName })}</div>
        <NewCourseForm
          organizationId={organizationId}
          onSubmitNewCourseForm={handleSubmit}
          onClose={onClose}
        />
      </div>
    </Dialog>
  )
}

export default NewCourseLanguageVersionDialog
