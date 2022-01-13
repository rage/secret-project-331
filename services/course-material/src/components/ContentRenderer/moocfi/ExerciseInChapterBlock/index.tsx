import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import CoursePageContext from "../../../../contexts/CoursePageContext"
import Spinner from "../../../../shared-module/components/Spinner"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import ExercisesInChapter from "./ExercisesInChapter"

const ExerciseInChapterBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(CoursePageContext)

  if (pageContext.state !== "ready") {
    return <Spinner variant={"small"} />
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
    <div className={normalWidthCenteredComponentStyles}>
      <ExercisesInChapter chapterId={chapterId} courseInstanceId={courseInstanceId} />
    </div>
  )
}

export default withErrorBoundary(ExerciseInChapterBlock)
