import { useContext } from "react"

import CourseProgress from "./CourseProgress"
import { BlockRendererProps } from ".."
import GenericLoading from "../../GenericLoading"
import CoursePageContext from "../../../contexts/CoursePageContext"

const ExerciseListBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const pageContext = useContext(CoursePageContext)

  if (pageContext.state !== "ready") {
    return <GenericLoading />
  }

  if (!pageContext.instance) {
    return <div>Select course version to see your progress.</div>
  }

  return <CourseProgress courseInstanceId={pageContext.instance.id} />
}

export default ExerciseListBlock
