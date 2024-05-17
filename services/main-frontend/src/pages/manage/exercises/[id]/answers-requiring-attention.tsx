import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import AnswersRequiringAttentionList from "../../../../components/page-specific/manage/exercises/id/submissions/AnswersRequiringAttentionList"
import { fetchAnswersRequiringAttention } from "../../../../services/backend/answers-requiring-attention"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Pagination from "@/shared-module/common/components/Pagination"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { primaryFont } from "@/shared-module/common/styles"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const SubmissionsPage: React.FC<SubmissionPageProps> = ({ query }) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()
  const getAnswersRequiringAttention = useQuery({
    queryKey: [
      `exercises-${query.id}-answers-requiring-attention`,
      paginationInfo.page,
      paginationInfo.limit,
    ],
    queryFn: () =>
      fetchAnswersRequiringAttention(query.id, paginationInfo.page, paginationInfo.limit),
  })
  return (
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
      {getAnswersRequiringAttention.isPending && <Spinner variant={"medium"} />}
      {getAnswersRequiringAttention.isSuccess && (
        <>
          <AnswersRequiringAttentionList
            answersRequiringAttention={getAnswersRequiringAttention.data.data}
            exercise_max_points={getAnswersRequiringAttention.data.exercise_max_points}
            refetch={getAnswersRequiringAttention.refetch}
          />
          <Pagination
            totalPages={getAnswersRequiringAttention.data?.total_pages}
            paginationInfo={paginationInfo}
          />
        </>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(SubmissionsPage)))
