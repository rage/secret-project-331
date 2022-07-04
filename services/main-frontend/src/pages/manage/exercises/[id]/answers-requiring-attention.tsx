import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import AnswersRequiringAttentionList from "../../../../components/page-specific/manage/exercises/id/submissions/AnswersRequiringAttentionList"
import { fetchAnswersRequiringAttention } from "../../../../services/backend/answers-requiring-attention"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const SubmissionsPage: React.FC<SubmissionPageProps> = ({ query }) => {
  const { t } = useTranslation()
  const getAnswersRequiringAttention = useQuery(
    `exercise-${query.id}-answers-requiring-attention`,
    () => fetchAnswersRequiringAttention(query.id),
  )

  return (
    <Layout navVariant="simple">
      <div>
        <h4>{t("header-answers-requiring-attention")}</h4>
        {getAnswersRequiringAttention.isError && (
          <ErrorBanner variant={"readOnly"} error={getAnswersRequiringAttention.error} />
        )}
        {(getAnswersRequiringAttention.isLoading || getAnswersRequiringAttention.isIdle) && (
          <Spinner variant={"medium"} />
        )}
        {getAnswersRequiringAttention.isSuccess && (
          <AnswersRequiringAttentionList
            answersRequiringAttention={getAnswersRequiringAttention.data.data}
          />
        )}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(SubmissionsPage)))
