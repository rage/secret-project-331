import React, { useContext } from "react"

import Congratulations from "./Congratulations"

import PageContext from "@/contexts/PageContext"
import useUserModuleCompletions from "@/hooks/useUserModuleCompletions"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const CongratulationsBlock: React.FC = () => {
  const pageContext = useContext(PageContext)
  const courseInstanceId = pageContext.instance?.id
  const getModuleCompletions = useUserModuleCompletions(courseInstanceId)
  const loginStateContext = useContext(LoginStateContext)
  if (!loginStateContext.signedIn) {
    return null
  }

  return (
    <>
      {getModuleCompletions.isError && (
        <ErrorBanner error={getModuleCompletions.error} variant="readOnly" />
      )}
      {getModuleCompletions.isLoading && null}
      {getModuleCompletions.isSuccess && (
        <>
          {/* This block is only visible after the default module is completed.*/}
          {courseInstanceId &&
            getModuleCompletions.data.some(
              (x) => x.default && x.completed && !x.needs_to_be_reviewed,
            ) && (
              <BreakFromCentered sidebar={false}>
                <Congratulations modules={getModuleCompletions.data} />
              </BreakFromCentered>
            )}
        </>
      )}
    </>
  )
}

export default withErrorBoundary(CongratulationsBlock)
