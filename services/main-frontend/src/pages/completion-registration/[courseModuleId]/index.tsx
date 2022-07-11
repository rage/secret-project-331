import { useRouter } from "next/router"
import React from "react"
import { useQuery } from "react-query"

import Layout from "../../../components/Layout"
import RegisterCompletion from "../../../components/page-specific/register-completion/RegisterCompletion"
import { fetchUserCompletionInformation } from "../../../services/backend/course-modules"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const REDIRECT = "redirect"

export interface CompletionPageProps {
  query: SimplifiedUrlQuery<"courseModuleId">
}

const CompletionPage: React.FC<CompletionPageProps> = ({ query }) => {
  const { courseModuleId } = query
  const router = useRouter()
  const userCompletionInformation = useQuery(
    `course-module-${courseModuleId}-completion-information`,
    () => fetchUserCompletionInformation(courseModuleId),
  )
  return (
    <Layout>
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

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(CompletionPage)))
