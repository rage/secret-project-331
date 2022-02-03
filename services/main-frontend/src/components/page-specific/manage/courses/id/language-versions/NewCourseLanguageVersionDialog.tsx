import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import { useTranslation } from "react-i18next"

import { NewCourse } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import NewCourseForm from "../../../../../forms/NewCourseForm"

interface NewCourseLanguageVersionDialogProps {
  showNewLanguageVersionForm: boolean
  courseName: string
  organizationId: string
  handleSubmit: (newCourse: NewCourse) => Promise<void>
  onClose: () => void
}

const NewCourseLanguageVersionDialog: React.FC<NewCourseLanguageVersionDialogProps> = ({
  showNewLanguageVersionForm,
  courseName,
  handleSubmit,
  onClose,
  organizationId,
}) => {
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
          onSubmitForm={handleSubmit}
          onClose={onClose}
        />
      </div>
    </Dialog>
  )
}

export default NewCourseLanguageVersionDialog
