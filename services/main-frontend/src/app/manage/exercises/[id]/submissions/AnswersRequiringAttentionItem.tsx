"use client"

import { css } from "@emotion/css"
import React, { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import FlaggedPeerReviewAccordion from "./FlaggedPeerReviewAccordion"
import PeerOrSelfReviewAccordion from "./PeerOrSelfReviewAccordion"
import TeacherGradingDecisionControls from "./TeacherGradingDecisionControls"

import SubmissionIFrame from "@/app/submissions/[id]/grading/SubmissionIFrame"
import { UserDisplay } from "@/components/UserDisplay"
import {
  ExerciseCardHeader,
  ExerciseCardPointsBadge,
  ExerciseCardWrapper,
} from "@/components/exercise-card"
import { createTeacherGradingDecisionMutation } from "@/generated/api/@tanstack/react-query.generated"
import type {
  AnswerRequiringAttentionWithTasks,
  NewTeacherGradingDecision,
} from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme, headingFont, primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { dateToString } from "@/shared-module/common/utils/time"

interface Props {
  answerRequiringAttention: AnswerRequiringAttentionWithTasks
  exerciseMaxPoints: number
  courseId: string | null
  refetch: () => void
}

const AnswersRequiringAttentionItem: React.FC<Props> = ({
  answerRequiringAttention,
  exerciseMaxPoints,
  courseId,
  refetch,
}) => {
  const { t } = useTranslation()
  const [updatedPoints, setUpdatedPoints] = useState<number | null>(null)

  const submitMutation = useToastMutationOptions(
    createTeacherGradingDecisionMutation(),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: (data) => {
        if (data) {
          setUpdatedPoints(data.score_given ?? null)
        } else {
          // In case that teacher used reject and reset
          refetch()
        }
      },
    },
  )
  const handleGradingDecisionSubmit = useCallback(
    async (decision: NewTeacherGradingDecision) => {
      submitMutation.mutate({
        body: decision,
      })
      // Not refetching here because we want to just gray out the item so that if the user has misclicked, they can still see the item and correct their mistake.
    },
    [submitMutation],
  )

  return (
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
                <UserDisplay userId={answerRequiringAttention.user_id} courseId={courseId} />
                <br />
                {dateToString(answerRequiringAttention.created_at)}
              </div>
            </h2>
          }
          rightContent={
            <ExerciseCardPointsBadge
              score={
                updatedPoints === null
                  ? (answerRequiringAttention.score_given ?? null)
                  : updatedPoints
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
              color: ${baseTheme.colors.gray[700]};
              font-weight: 500;
              font-size: 20px;
              line-height: 20px;
              text-transform: uppercase;
            `}
          >
            {t("student-answer")}
          </p>

          {answerRequiringAttention.tasks
            .slice()
            .toSorted((a, b) => a.order_number - b.order_number)
            .map((task) => (
              <SubmissionIFrame key={task.id} coursematerialExerciseTask={task} throttled />
            ))}
          <div
            className={css`
              margin-top: 1.5rem;
              background: ${baseTheme.colors.primary[100]};
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
                courseId={courseId}
              />

              <PeerOrSelfReviewAccordion
                peerOrSelfReviews={answerRequiringAttention.given_peer_reviews}
                title={t("given-peer-reviews-to-other-students")}
                courseId={courseId}
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
  )
}

export default AnswersRequiringAttentionItem
