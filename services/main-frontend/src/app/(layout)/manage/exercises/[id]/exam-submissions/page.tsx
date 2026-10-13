"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { getExam as getExamFromApi } from "@/generated/api/sdk.generated"
import useExamSubmissionsInfo from "@/hooks/useExamSubmissionsInfo"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { fontWeights, headingFont } from "@/shared-module/common/styles"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"
import { submissionGradingRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  Breadcrumbs,
  Button,
  EmptyState,
  Pagination,
  QueryResult,
  Table,
  type BreadcrumbItem,
} from "@/shared-module/components"

const positiveCss = css`
  color: #32bea6;
`

const negativeCss = css`
  color: #f76d82;
`

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
      <Breadcrumbs items={items} />
      <QueryResult query={getSubmissions}>
        {(getSubmissionsData) =>
          getSubmissionsData.data.length === 0 ? (
            <EmptyState title={t("no-submissions")} />
          ) : (
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
                <Table
                  caption={t("header-submissions")}
                  rows={getSubmissionsData.data}
                  rowKey={(submission) => submission.exercise_slide_submission.id}
                  className={css`
                    margin-top: 1.5rem;
                  `}
                  columns={[
                    {
                      header: t("label-action"),
                      cell: (submission) => {
                        const needsGrading =
                          getExam.data?.grade_manually && !submission.teacher_grading_decision
                        return (
                          <Button
                            variant={needsGrading ? "primary" : "secondary"}
                            size={"small"}
                            onClick={() => {
                              router.push(
                                submissionGradingRoute(submission.exercise_slide_submission.id),
                              )
                            }}
                          >
                            {needsGrading ? t("grade") : t("label-review")}
                          </Button>
                        )
                      },
                    },
                    {
                      header: t("user-id"),
                      cell: (submission) => submission.exercise_slide_submission.user_id,
                    },
                    {
                      header: t("status"),
                      cell: (submission) => {
                        if (!getExam.data?.grade_manually) {
                          return (
                            <span className={positiveCss}>{t("label-graded-automatically")}</span>
                          )
                        }
                        return submission.teacher_grading_decision ? (
                          <span className={positiveCss}>{t("status-graded")}</span>
                        ) : (
                          <span className={negativeCss}>{t("status-ungraded")}</span>
                        )
                      },
                    },
                    {
                      header: t("published"),
                      cell: (submission) => {
                        if (!getExam.data?.grade_manually || !submission.teacher_grading_decision) {
                          return "-"
                        }
                        return submission.teacher_grading_decision.hidden ? (
                          <span className={negativeCss}>{t("unpublished")}</span>
                        ) : (
                          <span className={positiveCss}>{t("published")}</span>
                        )
                      },
                    },
                    {
                      header: t("label-submission-time"),
                      cell: (submission) =>
                        dateToString(submission.exercise_slide_submission.created_at),
                    },
                    {
                      header: t("label-points"),
                      cell: (submission) => {
                        const scoreGiven = getExam.data?.grade_manually
                          ? (submission.teacher_grading_decision?.score_given ?? 0)
                          : submission.user_exercise_state.score_given
                        return `${scoreGiven} / ${submission.exercise.score_maximum}`
                      },
                    },
                  ]}
                />
                <Pagination
                  totalPages={getSubmissionsData.total_pages}
                  page={paginationInfo.page}
                  onPageChange={paginationInfo.setPage}
                  itemsPerPage={paginationInfo.limit}
                  onItemsPerPageChange={paginationInfo.setLimit}
                />
              </>
            )
          )
        }
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(GradingPage))
