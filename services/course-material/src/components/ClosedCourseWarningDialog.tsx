import { useContext } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "@/contexts/PageContext"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

const ClosedCourseWarningDialog = () => {
  const { t } = useTranslation("course-material")

  const pageContext = useContext(PageContext)
  const course = pageContext.course

  if (!course) {
    return null
  }

  return (
    <StandardDialog open={true} title={t("course-closed-warning-title")}>
      <div>
        <p>{t("course-closed-warning-message")}</p>
        <p>{t("course-closed-successor-message")}</p>
        {course.closed_additional_message && (
          <p>
            {t("course-closed-additional-message", { message: course.closed_additional_message })}
          </p>
        )}
      </div>
    </StandardDialog>
  )
}

export default ClosedCourseWarningDialog
