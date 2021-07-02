import { useContext } from "react"
import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import GenericLoading from "../../GenericLoading"
import CourseProgress from "./CourseProgress"

const ExerciseListBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const courseInstanceId = useContext(PageContext)?.instance?.id

  if (courseInstanceId) {
    return <CourseProgress courseInstanceId={courseInstanceId} />
  }

  return <GenericLoading />
}

export default ExerciseListBlock
