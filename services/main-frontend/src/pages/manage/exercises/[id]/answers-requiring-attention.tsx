import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import AnswersRequiringAttentionList from "../../../../components/page-specific/manage/exercises/id/submissions/AnswersRequiringAttentionList"
import { fetchAnswersRequiringAttention } from "../../../../services/backend/answers-requiring-attention"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { primaryFont } from "../../../../shared-module/styles"
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
        <h4
          className={css`
            color: #313947;
            font-family: ${primaryFont};
            font-size: 30px;
            font-weight: 500;
            line-height: 30px;
            letter-spacing: 0em;
            text-align: center;
            opacity: 0.8;
            margin-bottom: 1em;
          `}
        >
          {t("header-answers-requiring-attention")}
        </h4>
        {getAnswersRequiringAttention.isError && (
          <ErrorBanner variant={"readOnly"} error={getAnswersRequiringAttention.error} />
        )}
        {(getAnswersRequiringAttention.isLoading || getAnswersRequiringAttention.isIdle) && (
          <Spinner variant={"medium"} />
        )}
        {getAnswersRequiringAttention.isSuccess && (
          <AnswersRequiringAttentionList
            answersRequiringAttention={getAnswersRequiringAttention.data.data}
            exercise_max_points={getAnswersRequiringAttention.data.exercise_max_points}
          />
        )}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(SubmissionsPage)))
