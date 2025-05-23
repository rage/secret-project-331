import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { ExclamationMessage } from "@vectopus/atlas-icons-react"
import React, { useContext, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { exerciseButtonStyles, getExerciseBlockBeginningScrollingId } from ".."
import ContentRenderer from "../../.."
import {
  Block,
  fetchPeerOrSelfReviewDataByExerciseId,
  postFlagAnswerInPeerReview,
  postPeerOrSelfReviewSubmission,
} from "../../../../../services/backend"
import ExerciseTaskIframe from "../ExerciseTaskIframe"

import PeerOrSelfReviewQuestion from "./PeerOrSelfReviewQuestion"
import MarkAsSpamDialog from "./PeerRevireMarkingSpam/MarkAsSpamDialog"

import { getPeerReviewBeginningScrollingId, PeerOrSelfReviewViewProps } from "."

import {
  CourseMaterialPeerOrSelfReviewQuestionAnswer,
  ReportReason,
} from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import PeerReviewProgress from "@/shared-module/common/components/PeerReview/PeerReviewProgress"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { narrowContainerWidthPx } from "@/shared-module/common/styles/constants"
import getGuestPseudonymousUserId from "@/shared-module/common/utils/getGuestPseudonymousUserId"
import { exerciseTaskGradingToExerciseTaskGradingResult } from "@/shared-module/common/utils/typeMappter"

const PeerOrSelfReviewViewImpl: React.FC<React.PropsWithChildren<PeerOrSelfReviewViewProps>> = ({
  exerciseNumber,
  exerciseId,
  parentExerciseQuery,
  selfReview,
}) => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const [answers, setAnswers] = useState<Map<string, CourseMaterialPeerOrSelfReviewQuestionAnswer>>(
    new Map(),
  )
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)

  const query = useQuery({
    queryKey: [`exercise-${exerciseId}-peer-or-self-review`],
    queryFn: () => {
      return fetchPeerOrSelfReviewDataByExerciseId(exerciseId)
    },
    // 23 hours in ms. Need to refetch at this time because the given peer review candidate expires in 24 hours, and someone might leave the peer review view open for longer than that
    refetchInterval: 82800000,
  })

  const peerOrSelfReviewData = query.data?.course_material_peer_or_self_review_data

  const isValid = useMemo(() => {
    if (!peerOrSelfReviewData) {
      return false
    }
    return peerOrSelfReviewData.peer_or_self_review_questions.every((question) => {
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
  }, [answers, peerOrSelfReviewData])

  const submitPeerOrSelfReviewMutation = useToastMutation(
    async () => {
      const token = query.data?.token
      if (!peerOrSelfReviewData || !peerOrSelfReviewData.answer_to_review || !token) {
        return
      }
      return await postPeerOrSelfReviewSubmission(exerciseId, {
        exercise_slide_submission_id:
          peerOrSelfReviewData.answer_to_review.exercise_slide_submission_id,
        peer_or_self_review_config_id: peerOrSelfReviewData.peer_or_self_review_config.id,
        peer_review_question_answers: Array.from(answers.values()),
        token,
      })
    },
    { notify: true, method: "POST" },
    {
      onSuccess: async () => {
        // still old data because we have't refetched yet
        const givenEnoughReviews =
          (peerOrSelfReviewData?.peer_or_self_review_config.peer_reviews_to_give ??
            Number.MAX_VALUE) <=
          (peerOrSelfReviewData?.num_peer_reviews_given ?? 0) + 1

        if (givenEnoughReviews || selfReview) {
          await parentExerciseQuery.refetch()
          // Will scroll after once the refetch is complete because the refetch might change the heights of some elements and that would invalidate our current scrolling position
          setTimeout(() => {
            document
              .getElementById(getExerciseBlockBeginningScrollingId(exerciseId))
              ?.scrollIntoView({ behavior: "smooth" })
          }, 100)
        }

        // This refetch after the potential exercise refetch because the exercise refetch might close this view and if we refetched this first, we would show an extra intermediate view which would look confusing to the user
        await query.refetch()

        if (!givenEnoughReviews && !selfReview) {
          // Will scroll after once the refetch is complete because the refetch might change the heights of some elements and that would invalidate our current scrolling position
          setTimeout(() => {
            document
              .getElementById(getPeerReviewBeginningScrollingId(exerciseId))

              ?.scrollIntoView({ behavior: "smooth" })
          }, 100)
        }

        setAnswers(new Map())
      },
    },
  )

  const reportMutation = useToastMutation(
    async ({ reason, description }: { reason: ReportReason; description: string }) => {
      if (!peerOrSelfReviewData || !peerOrSelfReviewData.answer_to_review) {
        return
      }
      const token = query.data?.token
      if (!peerOrSelfReviewData || !peerOrSelfReviewData.answer_to_review || !token) {
        return
      }
      return await postFlagAnswerInPeerReview(exerciseId, {
        submission_id: peerOrSelfReviewData.answer_to_review.exercise_slide_submission_id,
        reason,
        description,
        flagged_user: null,
        flagged_by: null,
        peer_or_self_review_config_id: peerOrSelfReviewData.peer_or_self_review_config.id,
        token: token,
      })
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setIsReportDialogOpen(false)
        setAnswers(new Map())
        query.refetch()
      },
    },
  )

  const handleReportSubmit = (reason: ReportReason, description: string) => {
    reportMutation.mutate({ reason, description })
  }

  if (query.isError) {
    return <ErrorBanner variant={"readOnly"} error={query.error} />
  }

  // Uses isFetching instead of isPending because we want there to be a visual indication when the refresh button is clicked
  if (query.isFetching || !query.data) {
    return <Spinner variant="medium" />
  }

  if (!peerOrSelfReviewData?.answer_to_review?.course_material_exercise_tasks) {
    return (
      <div>
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
          {t("help-text-no-answers-to-peer-review-yet")}
        </div>
        <button
          className={cx(exerciseButtonStyles)}
          onClick={() => query.refetch()}
          disabled={query.isPending}
        >
          {t("button-text-refresh")}
        </button>
      </div>
    )
  }

  return (
    <div
      className={css`
        margin-top: 1rem;
      `}
    >
      {!selfReview && (
        <PeerReviewProgress
          total={peerOrSelfReviewData.peer_or_self_review_config.peer_reviews_to_give}
          attempt={peerOrSelfReviewData.num_peer_reviews_given}
        />
      )}

      {Boolean(peerOrSelfReviewData.peer_or_self_review_config.review_instructions) && (
        <div
          className={css`
            border: 0;
            margin-bottom: 1rem;
            background-color: #fff;
            padding: 0.8rem 1.25rem;
            border-radius: 0.625rem;
          `}
        >
          <h4
            className={css`
              padding-bottom: 0.5rem;
              font-weight: 600;
              font-size: 20px;
            `}
          >
            {selfReview ? t("title-self-review-instructions") : t("title-peer-review-instructions")}
          </h4>

          <ContentRenderer
            data={
              peerOrSelfReviewData.peer_or_self_review_config
                .review_instructions as Block<unknown>[]
            }
            isExam={false}
          />
        </div>
      )}

      <div>
        {peerOrSelfReviewData.answer_to_review.course_material_exercise_tasks
          .sort((a, b) => a.order_number - b.order_number)
          .map((course_material_exercise_task) => {
            return (
              <div key={course_material_exercise_task.id}>
                <div data-testid="assignment">
                  <ContentRenderer
                    data={(course_material_exercise_task.assignment as Array<Block<unknown>>) ?? []}
                    isExam={false}
                    dontAllowBlockToBeWiderThanContainerWidth={true}
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
                  headingBeforeIframe={
                    selfReview
                      ? t("title-your-answer")
                      : t("title-answer-submitted-by-another-student")
                  }
                />
              </div>
            )
          })}
      </div>

      <hr
        className={css`
          margin-top: 3rem;
          margin-bottom: 2rem;
          background-color: #e0e0e0;
          height: 5px;
          border: none;
        `}
      />

      {peerOrSelfReviewData.peer_or_self_review_questions
        .sort((a, b) => a.order_number - b.order_number)
        .map((question) => (
          <PeerOrSelfReviewQuestion
            key={question.id}
            question={question}
            peerOrSelfReviewQuestionAnswer={answers.get(question.id) ?? null}
            setPeerOrSelfReviewQuestionAnswer={(newAnswer) => {
              setAnswers((prev) => {
                const answers = new Map(prev)
                if (
                  newAnswer.number_data === null &&
                  (newAnswer.text_data === null || newAnswer.text_data.trim() === "")
                ) {
                  // If everything in the answer is null, transform the answer to not answered
                  answers.delete(question.id)
                } else {
                  answers.set(question.id, {
                    ...newAnswer,
                    peer_or_self_review_question_id: question.id,
                  })
                }

                return answers
              })
            }}
          />
        ))}

      <button
        className={cx(
          css`
            margin-top: 2.5rem !important;
          `,
          exerciseButtonStyles,
        )}
        disabled={!isValid || !peerOrSelfReviewData || submitPeerOrSelfReviewMutation.isPending}
        onClick={() => submitPeerOrSelfReviewMutation.mutate()}
      >
        {t("submit-button")}
      </button>
      <Button
        className={css`
          display: flex !important;
          align-items: center;
          gap: 6px;
        `}
        variant={"icon"}
        transform="capitalize"
        size={"small"}
        onClick={() => setIsReportDialogOpen(true)}
      >
        <ExclamationMessage /> {t("button-text-report")}
      </Button>

      <MarkAsSpamDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onSubmit={handleReportSubmit}
      />
    </div>
  )
}

export default PeerOrSelfReviewViewImpl
