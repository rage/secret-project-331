import { useRouter } from "next/router"
import React from "react"
import { useQuery } from "react-query"

import Layout from "../../../../../components/layout/Layout"
import RegisterCompletion from "../../../../../components/page-specific/register-completion/RegisterCompletion"
import { fetchUserCompletionInformation } from "../../../../../services/backend"
import ErrorBanner from "../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../shared-module/components/Spinner"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../../shared-module/utils/withErrorBoundary"

const REDIRECT = "redirect"

export interface CompletionPageProps {
  query: SimplifiedUrlQuery<string>
}

const CompletionPage: React.FC<CompletionPageProps> = ({ query }) => {
  const { courseSlug, organizationSlug } = query
  const router = useRouter()
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
        <RegisterCompletion
          data={userCompletionInformation.data}
          registrationFormUrl={`${router.asPath.split("?")[0]}/${REDIRECT}`}
        />
      )}
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CompletionPage))
