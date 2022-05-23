import { css } from "@emotion/css"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { postPeerReviewSubmission } from "../../../../../services/backend"
import {
  CourseMaterialPeerReviewData,
  CourseMaterialPeerReviewQuestionAnswer,
} from "../../../../../shared-module/bindings"
import Button from "../../../../../shared-module/components/Button"
import BreakFromCentered from "../../../../../shared-module/components/Centering/BreakFromCentered"
import Centered from "../../../../../shared-module/components/Centering/Centered"
import DebugModal from "../../../../../shared-module/components/DebugModal"
import PeerReviewProgress from "../../../../../shared-module/components/PeerReview/PeerReviewProgress"
import useToastMutation from "../../../../../shared-module/hooks/useToastMutation"
import { baseTheme } from "../../../../../shared-module/styles"
import { narrowContainerWidthPx } from "../../../../../shared-module/styles/constants"
import ExerciseTaskIframe from "../ExerciseTaskIframe"

import PeerReviewQuestion from "./PeerReviewQuestion"

export interface PeerReviewViewProps {
  peerReviewData: CourseMaterialPeerReviewData | null
  exerciseNumber: number
  exerciseId: string
}

const PeerReviewView: React.FC<PeerReviewViewProps> = ({
  peerReviewData,
  exerciseNumber,
  exerciseId,
}) => {
  const { t } = useTranslation()
  const [answers, setAnswers] = useState<Map<string, CourseMaterialPeerReviewQuestionAnswer>>(
    new Map(),
  )

  const isValid = useMemo(() => {
    if (!peerReviewData) {
      return false
    }
    return peerReviewData.peer_review_questions.every((question) => {
      if (!question.answer_required) {
        return true
      }
      const answer = answers.get(question.id)
      if (!answer) {
        return false
      }

      if (answer.number_data !== null) {
        return true
      }

      if (answer.text_data !== null && answer.text_data.trim() !== "") {
        return true
      }

      return false
    })
  }, [answers, peerReviewData])

  const submitPeerReviewMutation = useToastMutation(
    async () => {
      if (!peerReviewData) {
        return
      }
      return await postPeerReviewSubmission(exerciseId, {
        exercise_slide_submission_id: peerReviewData.exercise_slide_submission_id,
        peer_review_id: peerReviewData.peer_review.id,
        peer_review_question_answers: Array.from(answers.values()),
      })
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        // TODO refetch either exercise details or peer review details
      },
    },
  )

  if (!peerReviewData) {
    return <div>{t("help-text-no-answers-to-peer-review-yet")}</div>
  }

  return (
    <div
      className={css`
        margin-top: 3rem;
      `}
    >
      <h3
        className={css`
          font-weight: 600;
          font-size: 36px;
          line-height: 50px;
          text-align: center;
          margin-bottom: 1rem;

          color: ${baseTheme.colors.grey[700]};
        `}
      >
        {t("title-peer-review")}
      </h3>
      <PeerReviewProgress
        total={peerReviewData.peer_review.peer_reviews_to_give}
        attempt={peerReviewData.num_peer_reviews_given}
      />

      <div
        className={css`
          margin-bottom: 2rem;
        `}
      >
        <div
          className={css`
            border-bottom: 3px solid #f8f8f8;
          `}
        >
          <h4
            className={css`
              padding-bottom: 0.5rem;
              font-weight: 600;
              font-size: 20px;
            `}
          >
            {t("title-instructions")}
          </h4>
        </div>
        <div>
          <p>{t("peer-review-instruction")}</p>
        </div>
      </div>

      <BreakFromCentered sidebar={false}>
        <div>
          <Centered variant="narrow">
            <div>
              <h4
                className={css`
                  margin-bottom: 2rem;
                `}
              >
                {t("answer-from-another-student")}
              </h4>
              {peerReviewData.course_material_exercise_tasks
                .sort((a, b) => a.order_number - b.order_number)
                .map((course_material_exercise_task) => (
                  <ExerciseTaskIframe
                    key={course_material_exercise_task.id}
                    postThisStateToIFrame={{
                      // eslint-disable-next-line i18next/no-literal-string
                      view_type: "view-submission",
                      exercise_task_id: course_material_exercise_task.id,
                      data: {
                        grading: course_material_exercise_task.previous_submission_grading,
                        user_answer: course_material_exercise_task.previous_submission?.data_json,
                        public_spec: course_material_exercise_task.public_spec,
                        model_solution_spec: course_material_exercise_task.model_solution_spec,
                      },
                    }}
                    url={`${course_material_exercise_task.exercise_iframe_url}?width=${narrowContainerWidthPx}`}
                    setAnswer={null}
                    title={t("exercise-task-content", {
                      "exercise-number": exerciseNumber + 1,
                      "task-number": course_material_exercise_task.order_number + 1,
                    })}
                  />
                ))}
            </div>
          </Centered>
        </div>
        <hr
          className={css`
            margin-bottom: 2rem;
            background-color: #e0e0e0;
            height: 6px;
            border: none;
          `}
        />
      </BreakFromCentered>

      {peerReviewData.peer_review_questions
        .sort((a, b) => a.order_number - b.order_number)
        .map((question) => (
          <PeerReviewQuestion
            key={question.id}
            question={question}
            setPeerReviewQuestionAnswer={(newAnswer) => {
              setAnswers((prev) => {
                const answers = new Map(prev)
                answers.set(question.id, { ...newAnswer, peer_review_question_id: question.id })
                return answers
              })
            }}
          />
        ))}
      <Button
        size="medium"
        variant="primary"
        disabled={!isValid || !peerReviewData || submitPeerReviewMutation.isLoading}
        onClick={() => submitPeerReviewMutation.mutate()}
      >
        {t("submit-button")}
      </Button>
      <DebugModal data={peerReviewData} />
    </div>
  )
}

export default PeerReviewView
