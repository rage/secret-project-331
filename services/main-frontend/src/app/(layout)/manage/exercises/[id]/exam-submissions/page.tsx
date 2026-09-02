"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import { useParams, useRouter } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { getExam as getExamFromApi } from "@/generated/api/sdk.generated"
import useExamSubmissionsInfo from "@/hooks/useExamSubmissionsInfo"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import PaginationControls from "@/shared-module/common/components/PaginationControls"
import PaginationItemsPerPage from "@/shared-module/common/components/PaginationItemsPerPage"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"
import { submissionGradingRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Breadcrumbs, type BreadcrumbItem, Button, QueryResult } from "@/shared-module/components"

const GradingPage: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const paginationInfo = usePaginationInfo()
  const { id } = useParams<{ id: string }>()

  const getSubmissions = useExamSubmissionsInfo(id, paginationInfo.page, paginationInfo.limit)

  const examId = getSubmissions.data?.data[0]?.exercise.exam_id
  const getExam = useQuery({
    queryKey: ["getExam", examId],
    // oxlint-disable-next-line require-await -- async so the throw rejects the query promise
    queryFn: async () =>
      getExamFromApi({
        path: {
          id: assertNotNullOrUndefined(examId),
        },
      }),
    enabled: !!examId,
  })

  usePageTitle(joinTitleSegments([t("header-submissions"), getExam.data?.name]), { order: 10 })

  const items: BreadcrumbItem[] = useMemo(
    () => [
      // oxlint-disable-next-line i18next/no-literal-string
      { label: t("link-manage"), href: `/manage/exams/${examId}` },
      // oxlint-disable-next-line i18next/no-literal-string
      { label: t("questions"), href: `/manage/exams/${examId}/questions` },
      { label: t("header-submissions") },
    ],
    [examId, t],
  )

  return (
    <div>
      <BreakFromCentered sidebar={false}>
        <Breadcrumbs items={items} />
      </BreakFromCentered>
      <QueryResult query={getSubmissions}>
        {(getSubmissionsData) =>
          getExam.isSuccess && (
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
                  {getSubmissionsData.data.map((submission) => (
                    <tr key={submission.exercise_slide_submission.id}>
                      <td>
                        {getExam.data?.grade_manually ? (
                          submission.teacher_grading_decision ? (
                            <Button
                              variant={"secondary"}
                              size={"small"}
                              onClick={() => {
                                router.push(
                                  submissionGradingRoute(submission.exercise_slide_submission.id),
                                )
                              }}
                            >
                              {t("label-review")}
                            </Button>
                          ) : (
                            <Button
                              variant={"primary"}
                              size={"small"}
                              onClick={() => {
                                router.push(
                                  submissionGradingRoute(submission.exercise_slide_submission.id),
                                )
                              }}
                            >
                              {t("grade")}
                            </Button>
                          )
                        ) : (
                          <Button
                            variant={"secondary"}
                            size={"small"}
                            onClick={() => {
                              router.push(
                                submissionGradingRoute(submission.exercise_slide_submission.id),
                              )
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
              <PaginationControls
                totalPages={getSubmissionsData.total_pages}
                paginationInfo={paginationInfo}
              />
              <PaginationItemsPerPage paginationInfo={paginationInfo} />
            </>
          )
        }
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(GradingPage))
