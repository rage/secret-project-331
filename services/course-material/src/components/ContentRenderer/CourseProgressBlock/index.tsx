import { useContext } from "react"

import { BlockRendererProps } from ".."
import CoursePageContext from "../../../contexts/CoursePageContext"
import GenericLoading from "../../GenericLoading"

import CourseProgress from "./CourseProgress"

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
