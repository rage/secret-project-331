"use client"

import { useAtomValue } from "jotai"
import React, { useContext } from "react"

import type { BlockRendererProps } from ".."
import InnerBlocks from "../util/InnerBlocks"

import type { UserCourseSettings } from "@/generated/course-material-api/types.generated"
import useUserModuleCompletions from "@/hooks/course-material/useUserModuleCompletions"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { courseMaterialAtom } from "@/state/course-material"

interface ConditionalBlockProps {
  module_completion: string[]
  instance_enrollment: string[]
}

const ConditionalBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ConditionalBlockProps>>
> = (props) => {
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const courseInstanceId = courseMaterialState.instance?.id
  const userSettings: UserCourseSettings | null = courseMaterialState.settings
  const getModuleCompletions = useUserModuleCompletions(courseInstanceId)

  const completionsRequired = props.data.attributes.module_completion
  const enrollmentsRequired = props.data.attributes.instance_enrollment

  const loginStateContext = useContext(LoginStateContext)
  if (!loginStateContext.signedIn) {
    return null
  }

  const completionMet =
    completionsRequired.length === 0 ||
    (getModuleCompletions.isSuccess &&
      getModuleCompletions.data.some(
        (x) => x.completed && completionsRequired.some((id) => id === x.module_id),
      ))
  const enrollmentMet =
    enrollmentsRequired.length === 0 ||
    (userSettings?.current_course_instance_id &&
      enrollmentsRequired.some((x) => x === userSettings.current_course_instance_id))

  return (
    <>
      {completionMet && enrollmentMet && (
        <InnerBlocks
          parentBlockProps={props}
          dontAllowInnerBlocksToBeWiderThanParentBlock={false}
        />
      )}
    </>
  )
}

export default ConditionalBlock
