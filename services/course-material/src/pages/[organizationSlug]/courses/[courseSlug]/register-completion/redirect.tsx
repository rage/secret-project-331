import React from "react"
import { Trans, useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../../../../components/layout/Layout"
import { fetchCompletionRegistrationLink } from "../../../../../services/backend"
import ErrorBanner from "../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../shared-module/components/Spinner"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../../shared-module/utils/withErrorBoundary"

export interface CompletionRedirectPageProps {
  query: SimplifiedUrlQuery<string>
}

const CompletionRedirectPage: React.FC<CompletionRedirectPageProps> = ({ query }) => {
  const { courseSlug, organizationSlug } = query
  const { t } = useTranslation()
  const userCompletionInformation = useQuery(
    `course-${courseSlug}-completion-registration-link`,
    () => fetchCompletionRegistrationLink(courseSlug),
    {
      onSuccess: (data) => window.location.replace(data.url),
    },
  )
  return (
    <Layout organizationSlug={organizationSlug}>
      {userCompletionInformation.isError && (
        <ErrorBanner error={userCompletionInformation.error} variant={"readOnly"} />
      )}
      {userCompletionInformation.isLoading && <Spinner variant={"medium"} />}
      {userCompletionInformation.isSuccess && (
        <div>
          {/* NOTE: Manually clicking the link will leave redirection page to history. */}
          <Trans
            t={t}
            i18nKey="you-are-being-redirected-to-completion-registration-page-if-nothing-happens-click-here"
          >
            You are automatically being redirected to Open University&apos;s completion registration
            page. If nothing happens, please{" "}
            <a href={userCompletionInformation.data.url}>click here</a>.
          </Trans>
        </div>
      )}
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CompletionRedirectPage))
