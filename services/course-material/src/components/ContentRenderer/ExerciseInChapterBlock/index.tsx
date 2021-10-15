import { useContext } from "react"

import { BlockRendererProps } from ".."
import CoursePageContext from "../../../contexts/CoursePageContext"
import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import GenericLoading from "../../GenericLoading"

import ExercisesInChapter from "./ExercisesInChapter"

const ExerciseInChapterBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const pageContext = useContext(CoursePageContext)

  if (pageContext.state !== "ready") {
    return <GenericLoading />
  }

  const chapterId = pageContext.pageData.chapter_id
  const courseInstanceId = pageContext.instance?.id

  if (!chapterId) {
    return <pre>ExercisesInChapterBlock: Missing chapter id on this page.</pre>
  }
  if (!courseInstanceId) {
    return <pre>ExercisesInChapterBlock: Missing course instance id on this page.</pre>
  }

  return (
    <div className={courseMaterialCenteredComponentStyles}>
      <ExercisesInChapter chapterId={chapterId} courseInstanceId={courseInstanceId} />
    </div>
  )
}

export default withErrorBoundary(ExerciseInChapterBlock)
