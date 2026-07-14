"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import SubmissionIFrame from "./SubmissionIFrame"

import GradeExamAnswerForm from "@/components/forms/GradeExamAnswerForm"
import { getExerciseSlideSubmissionInfoOptions } from "@/generated/api/@tanstack/react-query.generated"
import { getExam as getExamFromApi } from "@/generated/api/sdk.generated"
import type { CourseMaterialExerciseTask } from "@/generated/api/types.generated"
import type { BreadcrumbPiece } from "@/shared-module/common/components/Breadcrumbs"
import Breadcrumbs from "@/shared-module/common/components/Breadcrumbs"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Centered from "@/shared-module/common/components/Centering/Centered"
import { PageMarginOffset } from "@/shared-module/common/components/layout/PageMarginOffset"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { fontWeights, headingFont } from "@/shared-module/common/styles"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "@/shared-module/common/utils/constants"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

interface Block<T> {
  name: string
  isValid: boolean
  clientId: string
  attributes: T
  innerBlocks: Block<unknown>[]
}

const Submission: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  usePageTitle(t("title-grading"))

  const getSubmissionInfo = useQuery({
    ...getExerciseSlideSubmissionInfoOptions({
      path: {
        submission_id: id,
      },
    }),
  })

  const handleGetAssignments = (task: CourseMaterialExerciseTask) => {
    // oxlint-disable-next-line typescript/no-explicit-any
    const assignments = task.assignment as Block<any>[]
    return assignments.map((assignment) => assignment.attributes?.content)
  }

  const examId = getSubmissionInfo.data?.exercise.exam_id
  const exerciseId = getSubmissionInfo.data?.exercise.id

  const getExam = useQuery({
    queryKey: ["getExam", examId],
    // oxlint-disable-next-line eslint/require-await -- async so the queryFn returns a normalized Promise
    queryFn: async () =>
      getExamFromApi({
        path: {
          id: assertNotNullOrUndefined(examId),
        },
      }),
    enabled: !!examId,
  })

  const pieces: BreadcrumbPiece[] = useMemo(() => {
    const breadcrumbPieces = [
      // oxlint-disable-next-line i18next/no-literal-string
      { text: t("link-manage"), url: `/manage/exams/${examId}` },
      // oxlint-disable-next-line i18next/no-literal-string
      { text: t("questions"), url: `/manage/exams/${examId}/questions` },
      {
        text: t("header-submissions"),
        // oxlint-disable-next-line i18next/no-literal-string
        url: `/manage/exercises/${exerciseId}/exam-submissions`,
      },
      { text: id, url: "" },
    ]
    return breadcrumbPieces
  }, [examId, exerciseId, id, t])

  return (
    <div>
      <BreakFromCentered sidebar={false}>
        <PageMarginOffset marginTop={`-${MARGIN_BETWEEN_NAVBAR_AND_CONTENT}`} marginBottom={"0rem"}>
          <Breadcrumbs pieces={pieces} />
        </PageMarginOffset>
      </BreakFromCentered>
      <QueryResult query={getSubmissionInfo}>
        {(submissionInfo) =>
          getExam.isSuccess && (
            <Centered variant="narrow">
              <div>
                <h1
                  className={css`
                    font-family: ${headingFont};
                    padding: 1.5rem 2rem;
                    font-size: 35px;
                    font-weight: ${fontWeights.semibold};
                    color: #333333;
                    opacity: 80%;
                  `}
                >
                  {t("label-grade")} {submissionInfo.exercise.name}
                </h1>
                {[...submissionInfo.tasks]
                  .toSorted((a, b) => a.order_number - b.order_number)
                  .map((task) => (
                    <div key={task.id}>
                      <div
                        className={css`
                          padding: 1.5rem 2rem;
                          display: flex;
                        `}
                      >
                        {handleGetAssignments(task)}
                      </div>
                      <SubmissionIFrame key={task.id} coursematerialExerciseTask={task} />
                      {!getExam.data?.grade_manually && (
                        <div
                          className={css`
                            padding: 1.5rem 2rem;
                            display: flex;
                          `}
                        >
                          {t("message-this-submission-has-been-graded-automatically")}:
                          <div
                            className={css`
                              padding-left: 0.5rem;
                            `}
                          >
                            {task.previous_submission_grading?.score_given} /
                            {task.previous_submission_grading?.unscaled_score_maximum}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              {getExam.data?.grade_manually && (
                <GradeExamAnswerForm submissionId={submissionInfo.exercise_slide_submission.id} />
              )}
            </Centered>
          )
        }
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(Submission)
