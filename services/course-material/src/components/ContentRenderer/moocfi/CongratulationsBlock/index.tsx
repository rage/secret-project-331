import React, { useContext } from "react"
import { useQuery } from "react-query"

import PageContext from "../../../../contexts/PageContext"
import { fetchUserModuleCompletionStatuses } from "../../../../services/backend"
import BreakFromCentered from "../../../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import Congratulations from "./Congratulations"

const CongratulationsBlock: React.FC = () => {
  const pageContext = useContext(PageContext)
  const courseInstanceId = pageContext.instance?.id
  const getModuleCompletions = useQuery(
    `course-instance-${courseInstanceId}-module-completions`,
    () =>
      fetchUserModuleCompletionStatuses(courseInstanceId as NonNullable<typeof courseInstanceId>),
    { enabled: !!courseInstanceId },
  )
  return (
    <>
      {getModuleCompletions.isError && (
        <ErrorBanner error={getModuleCompletions.error} variant="readOnly" />
      )}
      {getModuleCompletions.isLoading && <Spinner variant="medium" />}
      {getModuleCompletions.isSuccess && (
        <BreakFromCentered sidebar={false}>
          <Congratulations modules={getModuleCompletions.data} />
        </BreakFromCentered>
      )}
    </>
  )
}

export default withErrorBoundary(CongratulationsBlock)
