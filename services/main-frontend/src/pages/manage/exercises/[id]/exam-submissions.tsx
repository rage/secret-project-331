import { css } from "@emotion/css"
import { parseISO } from "date-fns"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import useExamSubmissionsInfo from "../../../../hooks/useExamSubmissionsInfo"
import Breadcrumbs, { BreadcrumbPiece } from "../../../../shared-module/components/Breadcrumbs"
import Button from "../../../../shared-module/components/Button"
import BreakFromCentered from "../../../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Pagination from "../../../../shared-module/components/Pagination"
import Spinner from "../../../../shared-module/components/Spinner"
import { PageMarginOffset } from "../../../../shared-module/components/layout/PageMarginOffset"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import usePaginationInfo from "../../../../shared-module/hooks/usePaginationInfo"
import { baseTheme, fontWeights, headingFont } from "../../../../shared-module/styles"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "../../../../shared-module/utils/constants"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}
const GradingPage: React.FC<React.PropsWithChildren<SubmissionPageProps>> = ({ query }) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()

  const getSubmissions = useExamSubmissionsInfo(query.id, paginationInfo.page, paginationInfo.limit)

  const examId = getSubmissions.data?.data[0].exercise.exam_id
  const pieces: BreadcrumbPiece[] = useMemo(() => {
    const pieces = [
      // eslint-disable-next-line i18next/no-literal-string
      { text: t("link-manage"), url: `/manage/exams/${examId}` },
      // eslint-disable-next-line i18next/no-literal-string
      { text: t("questions"), url: `/manage/exams/${examId}/questions` },
      { text: t("header-submissions"), url: "" },
    ]
    return pieces
  }, [examId, t])

  return (
    <div>
      <BreakFromCentered sidebar={false}>
        <PageMarginOffset
          marginTop={`-${MARGIN_BETWEEN_NAVBAR_AND_CONTENT}`}
          // eslint-disable-next-line i18next/no-literal-string
          marginBottom={"0rem"}
        >
          <Breadcrumbs pieces={pieces} />
        </PageMarginOffset>
      </BreakFromCentered>
      {getSubmissions.isError && <ErrorBanner variant={"readOnly"} error={getSubmissions.error} />}
      {getSubmissions.isPending && <Spinner variant={"medium"} />}
      {getSubmissions.isSuccess && (
        <>
          <h3
            className={css`
              font-weight: ${fontWeights.medium};
              font-family: ${headingFont};
            `}
          >
            {t("header-submissions")}
          </h3>
          <table
            className={css`
              border-collapse: collapse;
              margin-top: 1.5rem;
              width: 100%;

              td,
              th {
                padding-left: 20px;
                text-align: left;
                height: 60px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              tr {
                border-bottom: 1.5px solid #0000001a;
                font-size: ${baseTheme.fontSizes[18]};
              }
            `}
          >
            <thead>
              <tr
                className={css`
                  font-family: ${headingFont};
                  font-weight: ${fontWeights.semibold};
                  font-size: ${baseTheme.fontSizes[18]};
                  color: #7c7c7ccc;
                  opacity: 0.8;
                `}
              >
                <th>{t("label-action")}</th>
                <th>{t("user-id")}</th>
                <th>{t("status")}</th>
                <th>{t("published")}</th>
                <th>{t("label-submission-time")}</th>
                <th>{t("label-points")}</th>
              </tr>
            </thead>
            <tbody>
              {getSubmissions.data.data.map((submission) => (
                <tr key={submission.exercise_slide_submission.id}>
                  <td>
                    {submission.teacher_grading_decision ? (
                      <Button
                        variant={"secondary"}
                        size={"small"}
                        transform="none"
                        onClick={() => {
                          // eslint-disable-next-line i18next/no-literal-string
                          location.href = `/submissions/${submission.exercise_slide_submission.id}/grading/`
                        }}
                      >
                        {t("label-review")}
                      </Button>
                    ) : (
                      <Button
                        variant={"primary"}
                        size={"small"}
                        transform="none"
                        onClick={() => {
                          // eslint-disable-next-line i18next/no-literal-string
                          location.href = `/submissions/${submission.exercise_slide_submission.id}/grading/`
                        }}
                      >
                        {t("grade")}
                      </Button>
                    )}
                  </td>
                  <td>{submission.exercise_slide_submission.user_id}</td>
                  <td>
                    {submission.teacher_grading_decision ? (
                      <div
                        className={css`
                          color: #32bea6;
                        `}
                      >
                        {t("status-graded")}
                      </div>
                    ) : (
                      <div
                        className={css`
                          color: #f76d82;
                        `}
                      >
                        {t("status-ungraded")}
                      </div>
                    )}
                  </td>
                  <td>
                    {submission.teacher_grading_decision ? (
                      submission.teacher_grading_decision.hidden ? (
                        <div
                          className={css`
                            color: #f76d82;
                          `}
                        >
                          {t("unpublished")}
                        </div>
                      ) : (
                        <div
                          className={css`
                            color: #32bea6;
                          `}
                        >
                          {t("published")}
                        </div>
                      )
                    ) : (
                      <>-</>
                    )}
                  </td>
                  <td>
                    {parseISO(submission.exercise_slide_submission.created_at).toLocaleString()}
                  </td>
                  <td>
                    {submission.teacher_grading_decision
                      ? submission.teacher_grading_decision.score_given
                      : 0}
                    / {submission.exercise.score_maximum}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            totalPages={getSubmissions.data.total_pages}
            paginationInfo={paginationInfo}
          />
        </>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(GradingPage)))
