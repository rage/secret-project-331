import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import useUserModuleCompletions from "../../../hooks/useUserModuleCompletions"
import InnerBlocks from "../util/InnerBlocks"

import { UserCourseSettings } from "@/shared-module/common/bindings"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

interface ConditionalBlockProps {
  module_completion: string[]
  instance_enrollment: string[]
}

const ConditionalBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ConditionalBlockProps>>
> = (props) => {
  const pageContext = useContext(PageContext)
  const courseInstanceId = pageContext.instance?.id
  const userSettings: UserCourseSettings | null = pageContext.settings
  const getModuleCompletions = useUserModuleCompletions(courseInstanceId)

  const completionsRequired = props.data.attributes.module_completion
  const enrollmentsRequired = props.data.attributes.instance_enrollment

  const loginStateContext = useContext(LoginStateContext)
  if (!loginStateContext.signedIn) {
    return null
  }

  const completionMet =
    !completionsRequired.length ||
    (getModuleCompletions.isSuccess &&
      getModuleCompletions.data.some(
        (x) => x.completed && completionsRequired.some((id) => id == x.module_id),
      ))
  const enrollmentMet =
    !enrollmentsRequired.length ||
    (userSettings?.current_course_instance_id &&
      enrollmentsRequired.some((x) => x == userSettings.current_course_instance_id))
  !userSettings?.current_course_instance_id

  return <>{completionMet && enrollmentMet && <InnerBlocks parentBlockProps={props} />}</>
}

export default ConditionalBlock
