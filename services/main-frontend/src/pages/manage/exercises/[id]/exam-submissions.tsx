import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import useExamSubmissionsInfo from "../../../../hooks/useExamSubmissionsInfo"

import { fetchExam } from "@/services/backend/exams"
import Breadcrumbs, { BreadcrumbPiece } from "@/shared-module/common/components/Breadcrumbs"
import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Pagination from "@/shared-module/common/components/Pagination"
import Spinner from "@/shared-module/common/components/Spinner"
import { PageMarginOffset } from "@/shared-module/common/components/layout/PageMarginOffset"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "@/shared-module/common/utils/constants"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}
const GradingPage: React.FC<React.PropsWithChildren<SubmissionPageProps>> = ({ query }) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()

  const getSubmissions = useExamSubmissionsInfo(query.id, paginationInfo.page, paginationInfo.limit)

  const examId = getSubmissions.data?.data[0].exercise.exam_id
  const getExam = useQuery({
    queryKey: [`/exams/${examId}/`, examId],
    queryFn: () => fetchExam(examId ?? ""),
  })

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
        <PageMarginOffset marginTop={`-${MARGIN_BETWEEN_NAVBAR_AND_CONTENT}`} marginBottom={"0rem"}>
          <Breadcrumbs pieces={pieces} />
        </PageMarginOffset>
      </BreakFromCentered>
      {getSubmissions.isError && <ErrorBanner variant={"readOnly"} error={getSubmissions.error} />}
      {getSubmissions.isPending && <Spinner variant={"medium"} />}
      {getSubmissions.isSuccess && getExam.isSuccess && (
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
                    {getExam.data?.grade_manually ? (
                      submission.teacher_grading_decision ? (
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
                      )
                    ) : (
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
                    )}
                  </td>
                  <td>{submission.exercise_slide_submission.user_id}</td>
                  <td>
                    {getExam.data?.grade_manually ? (
                      submission.teacher_grading_decision ? (
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
                      )
                    ) : (
                      <div
                        className={css`
                          color: #32bea6;
                        `}
                      >
                        {t("label-graded-automatically")}
                      </div>
                    )}
                  </td>
                  <td>
                    {getExam.data?.grade_manually ? (
                      submission.teacher_grading_decision ? (
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
                      )
                    ) : (
                      <>-</>
                    )}
                  </td>
                  <td>
                    {parseISO(submission.exercise_slide_submission.created_at).toLocaleString()}
                  </td>
                  <td>
                    {getExam.data?.grade_manually
                      ? submission.teacher_grading_decision
                        ? submission.teacher_grading_decision.score_given
                        : 0
                      : submission.user_exercise_state.score_given}
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
