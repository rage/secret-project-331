"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { parseISO } from "date-fns"
import React, { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import FlaggedPeerReviewAccordion from "./FlaggedPeerReviewAccordion"
import PeerOrSelfReviewAccordion from "./PeerOrSelfReviewAccordion"
import TeacherGradingDecisionControls from "./TeacherGradingDecisionControls"

import SubmissionIFrame from "@/app/submissions/[id]/grading/SubmissionIFrame"
import {
  ExerciseCardHeader,
  ExerciseCardPointsBadge,
  ExerciseCardWrapper,
} from "@/components/exercise-card"
import { createTeacherGradingDecision } from "@/services/backend/teacher-grading-decisions"
import {
  AnswerRequiringAttentionWithTasks,
  NewTeacherGradingDecision,
} from "@/shared-module/common/bindings"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { headingFont, primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { dateToString } from "@/shared-module/common/utils/time"

interface Props {
  answerRequiringAttention: AnswerRequiringAttentionWithTasks
  exerciseMaxPoints: number
  refetch: () => void
}

const StatusPanel = styled.div`
  border-top: 3px solid rgba(112, 112, 112, 0.1);
  width: 100%;
  height: 70px;
  display: flex;
  align-items: center;
`

const AnswersRequiringAttentionItem: React.FC<Props> = ({
  answerRequiringAttention,
  exerciseMaxPoints,
  refetch,
}) => {
  const { t } = useTranslation()
  const [updatedPoints, setUpdatedPoints] = useState<number | null>(null)

  const submitMutation = useToastMutation(
    (update: NewTeacherGradingDecision) => {
      return createTeacherGradingDecision(update)
    },
    {
      notify: true,
      method: "PUT",
    },
    {
      onSuccess: (data) => {
        if (data) {
          setUpdatedPoints(data.score_given)
        } else {
          // In case that teacher used reject and reset
          refetch()
        }
      },
    },
  )
  const handleGradingDecisionSubmit = useCallback(
    async (decision: NewTeacherGradingDecision) => {
      submitMutation.mutate(decision)
      // Not refetching here because we want to just gray out the item so that if the user has misclicked, they can still see the item and correct their mistake.
    },
    [submitMutation],
  )

  return (
    <>
      <div
        className={css`
          margin-bottom: 4rem;
          ${updatedPoints !== null && `filter: opacity(0.7) brightness(1.1);`}
          ${respondToOrLarger.sm} {
            width: 100%;
          }
        `}
      >
        <ExerciseCardWrapper>
          <ExerciseCardHeader
            backgroundColor="#718dbf"
            title={
              <h2
                className={css`
                  font-size: 1.7rem;
                  font-weight: 500;
                  font-family: ${headingFont} !important;
                  overflow-wrap: anywhere;
                  overflow: hidden;
                  margin-top: -2px;
                `}
              >
                <div
                  className={css`
                    font-size: 1.2rem;
                    line-height: 1.4;
                    overflow: hidden;
                    padding-bottom: 0.2rem;
                  `}
                >
                  {answerRequiringAttention.user_id}
                  <br />
                  {dateToString(answerRequiringAttention.created_at)}
                </div>
              </h2>
            }
            rightContent={
              <ExerciseCardPointsBadge
                score={
                  (updatedPoints === null ? answerRequiringAttention.score_given : updatedPoints) ??
                  0
                }
                maxScore={exerciseMaxPoints}
              />
            }
          />

          <div
            className={css`
              padding: 0 1rem 1.5rem;
            `}
          >
            <p
              className={css`
                margin-top: 0;
                margin-bottom: 1em;
                font-family: ${primaryFont};
                color: #4b4b4b;
                font-weight: 500;
                font-size: 20px;
                line-height: 20px;
                text-transform: uppercase;
              `}
            >
              {t("student-answer")}
            </p>

            {answerRequiringAttention.tasks
              .sort((a, b) => a.order_number - b.order_number)
              .map((task) => (
                <SubmissionIFrame key={task.id} coursematerialExerciseTask={task} />
              ))}
            <div
              className={css`
                margin-top: 1.5rem;
                background: #ffffff;
                border-radius: 0.625rem;
                padding: 1rem 1.25rem 1.5rem;
                box-shadow:
                  rgba(15, 23, 42, 0.06) 0 1px 2px,
                  rgba(15, 23, 42, 0.04) 0 0 0 1px;
              `}
            >
              <TeacherGradingDecisionControls
                userExerciseStateId={answerRequiringAttention.id}
                exerciseId={answerRequiringAttention.exercise_id}
                exerciseMaxPoints={exerciseMaxPoints}
                onGradingDecisionSubmit={handleGradingDecisionSubmit}
              />

              <div
                className={css`
                  margin-top: 1.5rem;
                `}
              >
                <PeerOrSelfReviewAccordion
                  peerOrSelfReviews={answerRequiringAttention.received_peer_or_self_reviews}
                  title={t("received-reviews")}
                />

                <PeerOrSelfReviewAccordion
                  peerOrSelfReviews={answerRequiringAttention.given_peer_reviews}
                  title={t("given-peer-reviews-to-other-students")}
                />

                <FlaggedPeerReviewAccordion
                  reports={answerRequiringAttention.received_peer_review_flagging_reports}
                  title={t("label-received-reports")}
                />
              </div>
            </div>
          </div>
        </ExerciseCardWrapper>
      </div>
    </>
  )
}

export default AnswersRequiringAttentionItem
