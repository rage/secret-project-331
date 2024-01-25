import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useContext, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { getExerciseBlockBeginningScrollingId } from ".."
import ContentRenderer from "../../.."
import {
  Block,
  fetchPeerReviewDataByExerciseId,
  postPeerReviewSubmission,
} from "../../../../../services/backend"
import { CourseMaterialPeerReviewQuestionAnswer } from "../../../../../shared-module/common/bindings"
import Button from "../../../../../shared-module/common/components/Button"
import BreakFromCentered from "../../../../../shared-module/common/components/Centering/BreakFromCentered"
import Centered from "../../../../../shared-module/common/components/Centering/Centered"
import ErrorBanner from "../../../../../shared-module/common/components/ErrorBanner"
import PeerReviewProgress from "../../../../../shared-module/common/components/PeerReview/PeerReviewProgress"
import Spinner from "../../../../../shared-module/common/components/Spinner"
import LoginStateContext from "../../../../../shared-module/common/contexts/LoginStateContext"
import useToastMutation from "../../../../../shared-module/common/hooks/useToastMutation"
import { narrowContainerWidthPx } from "../../../../../shared-module/common/styles/constants"
import getGuestPseudonymousUserId from "../../../../../shared-module/common/utils/getGuestPseudonymousUserId"
import { exerciseTaskGradingToExerciseTaskGradingResult } from "../../../../../shared-module/common/utils/typeMappter"
import ExerciseTaskIframe from "../ExerciseTaskIframe"

import PeerReviewQuestion from "./PeerReviewQuestion"

import { getPeerReviewBeginningScrollingId, PeerReviewViewProps } from "."

const PeerReviewViewImpl: React.FC<React.PropsWithChildren<PeerReviewViewProps>> = ({
  exerciseNumber,
  exerciseId,
  parentExerciseQuery,
}) => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const [answers, setAnswers] = useState<Map<string, CourseMaterialPeerReviewQuestionAnswer>>(
    new Map(),
  )

  const query = useQuery({
    queryKey: [`exercise-${exerciseId}-peer-review`],
    queryFn: () => {
      return fetchPeerReviewDataByExerciseId(exerciseId)
    },
    // 23 hours in ms. Need to refetch at this time because the given peer review candidate expires in 24 hours, and someone might leave the peer review view open for longer than that
    refetchInterval: 82800000,
  })

  const peerReviewData = query.data?.course_material_peer_review_data

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
      const token = query.data?.token
      if (!peerReviewData || !peerReviewData.answer_to_review || !token) {
        return
      }
      return await postPeerReviewSubmission(exerciseId, {
        exercise_slide_submission_id: peerReviewData.answer_to_review.exercise_slide_submission_id,
        peer_review_config_id: peerReviewData.peer_review_config.id,
        peer_review_question_answers: Array.from(answers.values()),
        token,
      })
    },
    { notify: true, method: "POST" },
    {
      onSuccess: async () => {
        // still old data because we have't refetched yet
        const givenEnoughReviews =
          (peerReviewData?.peer_review_config.peer_reviews_to_give ?? Number.MAX_VALUE) <=
          (peerReviewData?.num_peer_reviews_given ?? 0) + 1

        if (givenEnoughReviews) {
          await parentExerciseQuery.refetch()
          // Will scroll after once the refetch is complete because the refetch might change the heights of some elements and that would invalidate our current scrolling position
          setTimeout(() => {
            document
              .getElementById(getExerciseBlockBeginningScrollingId(exerciseId))
              // eslint-disable-next-line i18next/no-literal-string
              ?.scrollIntoView({ behavior: "smooth" })
          }, 100)
        }

        // This refetch after the potential exercise refetch because the exercise refetch might close this view and if we refetched this first, we would show an extra intermediate view which would look confusing to the user
        await query.refetch()

        if (!givenEnoughReviews) {
          // Will scroll after once the refetch is complete because the refetch might change the heights of some elements and that would invalidate our current scrolling position
          setTimeout(() => {
            document
              .getElementById(getPeerReviewBeginningScrollingId(exerciseId))
              // eslint-disable-next-line i18next/no-literal-string
              ?.scrollIntoView({ behavior: "smooth" })
          }, 100)
        }

        setAnswers(new Map())
      },
    },
  )

  if (query.isError) {
    return <ErrorBanner error={query.error} />
  }

  if (query.isPending || !query.data) {
    return <Spinner variant="medium" />
  }

  if (!peerReviewData?.answer_to_review?.course_material_exercise_tasks) {
    return (
      <div>
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
          {t("help-text-no-answers-to-peer-review-yet")}
        </div>
        <Button
          variant="primary"
          onClick={() => query.refetch()}
          size="medium"
          disabled={query.isPending}
        >
          {t("button-text-refresh")}
        </Button>
      </div>
    )
  }

  return (
    <div
      className={css`
        margin-top: 3rem;
      `}
    >
      <PeerReviewProgress
        total={peerReviewData.peer_review_config.peer_reviews_to_give}
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
          <p>{t("peer-review-instructions")}</p>
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
              {peerReviewData.answer_to_review.course_material_exercise_tasks
                .sort((a, b) => a.order_number - b.order_number)
                .map((course_material_exercise_task) => {
                  return (
                    <div key={course_material_exercise_task.id}>
                      <div data-testid="assignment">
                        <ContentRenderer
                          data={
                            (course_material_exercise_task.assignment as Array<Block<unknown>>) ??
                            []
                          }
                          editing={false}
                          selectedBlockId={null}
                          setEdits={(map) => map}
                          isExam={false}
                        />
                      </div>
                      <ExerciseTaskIframe
                        exerciseServiceSlug={course_material_exercise_task.exercise_service_slug}
                        key={course_material_exercise_task.id}
                        postThisStateToIFrame={{
                          // eslint-disable-next-line i18next/no-literal-string
                          view_type: "view-submission",
                          exercise_task_id: course_material_exercise_task.id,
                          user_information: {
                            pseudonymous_id:
                              course_material_exercise_task.pseudonumous_user_id ??
                              getGuestPseudonymousUserId(),
                            signed_in: Boolean(loginStateContext.signedIn),
                          },
                          // Don't reveal peer revewiee user variables to peer reviewers in case they contain something sensitive
                          user_variables: {},
                          data: {
                            grading: exerciseTaskGradingToExerciseTaskGradingResult(
                              course_material_exercise_task.previous_submission_grading,
                            ),
                            user_answer:
                              course_material_exercise_task.previous_submission?.data_json,
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
                    </div>
                  )
                })}
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
            peerReviewQuestionAnswer={answers.get(question.id) ?? null}
            setPeerReviewQuestionAnswer={(newAnswer) => {
              setAnswers((prev) => {
                const answers = new Map(prev)
                if (
                  newAnswer.number_data === null &&
                  (newAnswer.text_data === null || newAnswer.text_data.trim() === "")
                ) {
                  // If everything in the answer is null, transform the answer to not answered
                  answers.delete(question.id)
                } else {
                  answers.set(question.id, { ...newAnswer, peer_review_question_id: question.id })
                }

                return answers
              })
            }}
          />
        ))}
      <Button
        size="medium"
        variant="primary"
        disabled={!isValid || !peerReviewData || submitPeerReviewMutation.isPending}
        onClick={() => submitPeerReviewMutation.mutate()}
      >
        {t("submit-button")}
      </Button>
    </div>
  )
}

export default PeerReviewViewImpl
