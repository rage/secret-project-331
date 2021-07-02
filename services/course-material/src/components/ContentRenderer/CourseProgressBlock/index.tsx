import { useContext } from "react"

import CourseProgress from "./CourseProgress"
import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import GenericLoading from "../../GenericLoading"
import OnlyForSignedUser from "../../../shared-module/components/OnlyForSignedUser"

const ExerciseListBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const courseInstanceId = useContext(PageContext)?.instance?.id

  return (
    <OnlyForSignedUser guestMessage="Sign in to see your progress.">
      {courseInstanceId ? (
        <CourseProgress courseInstanceId={courseInstanceId} />
      ) : (
        <GenericLoading />
      )}
    </OnlyForSignedUser>
  )
}

export default ExerciseListBlock
