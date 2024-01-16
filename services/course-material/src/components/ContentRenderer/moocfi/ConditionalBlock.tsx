import { useQuery } from "@tanstack/react-query"
import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import {
  fetchUserModuleCompletionStatuses,
  getCourseInstanceEnrollmentsInfo,
} from "../../../services/backend"
import LoginStateContext from "../../../shared-module/contexts/LoginStateContext"
import useUserInfo from "../../../shared-module/hooks/useUserInfo"
import InnerBlocks from "../util/InnerBlocks"

interface ConditionalBlockProps {
  module_completion: boolean
  instance_enrollment: boolean
}

const ConditionalBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ConditionalBlockProps>>
> = (props) => {
  const pageContext = useContext(PageContext)
  const courseInstanceId = pageContext.instance?.id
  const userInfo = useUserInfo()
  const getModuleCompletions = useQuery({
    queryKey: [`course-instance-${courseInstanceId}-module-completions`],
    queryFn: () =>
      fetchUserModuleCompletionStatuses(courseInstanceId as NonNullable<typeof courseInstanceId>),
    enabled: !!courseInstanceId,
  })

  const courseInstanceEnrollmentsQuery = useQuery({
    queryKey: ["course-instance-enrollments", userInfo.data?.user_id],
    queryFn: () => getCourseInstanceEnrollmentsInfo(userInfo.data?.user_id ?? ""),
  })
  const completionRequired = props.data.attributes.module_completion

  const loginStateContext = useContext(LoginStateContext)
  if (!loginStateContext.signedIn) {
    return null
  }

  const completionMet =
    !completionRequired ||
    (getModuleCompletions.isSuccess && getModuleCompletions.data.some((x) => x.completed)) // Check the correct module
  const enrollmentMet =
    !props.data.attributes.instance_enrollment ||
    (userInfo.isSuccess && !courseInstanceEnrollmentsQuery.error) // Do something here

  console.log(completionMet, enrollmentMet)
  return <>{completionMet && enrollmentMet && <InnerBlocks parentBlockProps={props} />}</>
}

export default ConditionalBlock
