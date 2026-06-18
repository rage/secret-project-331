"use client"

import { useAtomValue } from "jotai"
import React, { useContext } from "react"

import Congratulations from "./Congratulations"

import { renderReadOnlyBlockingError } from "@/components/queryResultErrorRenderers"
import useUserModuleCompletions from "@/hooks/course-material/useUserModuleCompletions"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"
import { courseMaterialAtom } from "@/state/course-material"

const CongratulationsBlock: React.FC = () => {
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const courseInstanceId = courseMaterialState.instance?.id
  const getModuleCompletions = useUserModuleCompletions(courseInstanceId)
  const loginStateContext = useContext(LoginStateContext)
  if (!loginStateContext.signedIn) {
    return null
  }
  // The query is disabled without a course instance id, so it would otherwise show an
  // infinite loading skeleton.
  if (!courseInstanceId) {
    return null
  }

  return (
    <QueryResult query={getModuleCompletions} renderBlockingError={renderReadOnlyBlockingError}>
      {(modules) =>
        // This block is only visible after the default module is completed.
        modules.some((x) => x.default && x.completed) ? (
          <BreakFromCentered sidebar={false}>
            <Congratulations modules={modules} />
          </BreakFromCentered>
        ) : null
      }
    </QueryResult>
  )
}

export default withErrorBoundary(CongratulationsBlock)
