import React from "react"
import { useQuery } from "react-query"

import Layout from "../../../../../components/layout/Layout"
import { fetchUserCompletionInformation } from "../../../../../services/backend"
import ErrorBanner from "../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../shared-module/components/Spinner"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../../shared-module/utils/withErrorBoundary"

import RegisterCompletion from "./RegisterCompletion"

export interface CompletionPageProps {
  query: SimplifiedUrlQuery<string>
}

const CompletionPage: React.FC<CompletionPageProps> = ({ query }) => {
  const { courseSlug, organizationSlug } = query
  const userCompletionInformation = useQuery(`course-${courseSlug}-completion-information`, () =>
    fetchUserCompletionInformation(courseSlug),
  )
  return (
    <Layout organizationSlug={organizationSlug}>
      {userCompletionInformation.isError && (
        <ErrorBanner error={userCompletionInformation.error} variant={"readOnly"} />
      )}
      {userCompletionInformation.isLoading && <Spinner variant={"medium"} />}
      {userCompletionInformation.isSuccess && (
        <RegisterCompletion data={userCompletionInformation.data} />
      )}
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CompletionPage))
