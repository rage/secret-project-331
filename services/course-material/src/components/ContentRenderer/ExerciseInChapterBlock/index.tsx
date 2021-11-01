import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from ".."
import CoursePageContext from "../../../contexts/CoursePageContext"
import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import GenericLoading from "../../GenericLoading"

import ExercisesInChapter from "./ExercisesInChapter"

const ExerciseInChapterBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(CoursePageContext)

  if (pageContext.state !== "ready") {
    return <GenericLoading />
  }

  const chapterId = pageContext.pageData.chapter_id
  const courseInstanceId = pageContext.instance?.id

  if (!chapterId) {
    return <pre>{t("error-page-does-not-belong-to-chapter")}</pre>
  }
  if (!courseInstanceId) {
    return <pre>{t("error-missing-course-instance-id")}</pre>
  }

  return (
    <div className={courseMaterialCenteredComponentStyles}>
      <ExercisesInChapter chapterId={chapterId} courseInstanceId={courseInstanceId} />
    </div>
  )
}

export default withErrorBoundary(ExerciseInChapterBlock)
