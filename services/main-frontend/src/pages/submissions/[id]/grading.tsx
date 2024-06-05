import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import GradeExamAnswerForm from "../../../components/forms/GradeExamAnswerForm"
import SubmissionIFrame from "../../../components/page-specific/submissions/id/SubmissionIFrame"
import { Block } from "../../../services/backend/exercises"
import { fetchSubmissionInfo } from "../../../services/backend/submissions"
import { CourseMaterialExerciseTask } from "../../../shared-module/bindings"
import Breadcrumbs, { BreadcrumbPiece } from "../../../shared-module/components/Breadcrumbs"
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import Centered from "../../../shared-module/components/Centering/Centered"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import { PageMarginOffset } from "../../../shared-module/components/layout/PageMarginOffset"
import { fontWeights, headingFont } from "../../../shared-module/styles"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "../../../shared-module/utils/constants"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const Submission: React.FC<React.PropsWithChildren<SubmissionPageProps>> = ({ query }) => {
  const { t } = useTranslation()

  const getSubmissionInfo = useQuery({
    queryKey: [`submission-${query.id}`],
    queryFn: () => fetchSubmissionInfo(query.id),
  })

  const handleGetAssignments = (task: CourseMaterialExerciseTask) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignments = task.assignment as Block<any>[]
    return assignments.map((assignment) => assignment.attributes?.content)
  }

  const examId = getSubmissionInfo.data?.exercise.exam_id
  const exerciseId = getSubmissionInfo.data?.exercise.id
  const pieces: BreadcrumbPiece[] = useMemo(() => {
    const pieces = [
      // eslint-disable-next-line i18next/no-literal-string
      { text: t("link-manage"), url: `/manage/exams/${examId}` },
      // eslint-disable-next-line i18next/no-literal-string
      { text: t("questions"), url: `/manage/exams/${examId}/questions` },
      {
        text: t("header-submissions"),
        // eslint-disable-next-line i18next/no-literal-string
        url: `/manage/exercises/${exerciseId}/exam-submissions`,
      },
      { text: query.id, url: "" },
    ]
    return pieces
  }, [examId, exerciseId, query.id, t])

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
      {getSubmissionInfo.isError && (
        <ErrorBanner variant={"readOnly"} error={getSubmissionInfo.error} />
      )}
      {getSubmissionInfo.isPending && <Spinner variant={"medium"} />}
      {getSubmissionInfo.isSuccess && (
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
              {t("label-grade")} {getSubmissionInfo.data.exercise.name}
            </h1>
            {getSubmissionInfo.data.tasks
              .sort((a, b) => a.order_number - b.order_number)
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
                </div>
              ))}
          </div>
          <GradeExamAnswerForm submissionId={getSubmissionInfo.data.exercise_slide_submission.id} />
        </Centered>
      )}
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(Submission)
