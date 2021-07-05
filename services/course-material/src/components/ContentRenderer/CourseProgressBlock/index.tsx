import { useContext } from "react"

import CourseProgress from "./CourseProgress"
import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import GenericLoading from "../../GenericLoading"

const ExerciseListBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const pageContext = useContext(PageContext)
  const hasCourseInstance = pageContext?.instance !== null
  const courseInstanceId = pageContext?.instance?.id

  if (hasCourseInstance) {
    return <div>Select course version to see your progress.</div>
  }

  if (courseInstanceId) {
    return <CourseProgress courseInstanceId={courseInstanceId} />
  } else {
    return <GenericLoading />
  }
}

export default ExerciseListBlock
