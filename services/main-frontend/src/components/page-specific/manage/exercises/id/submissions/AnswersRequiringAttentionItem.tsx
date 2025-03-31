import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { ExclamationMessage } from "@vectopus/atlas-icons-react"
import { parseISO } from "date-fns"
import React, { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import SubmissionIFrame from "../../../../submissions/id/SubmissionIFrame"

import FlaggedPeerReviewAccordion from "./FlaggedPeerReviewAccordion"
import PeerOrSelfReviewAccordion from "./PeerOrSelfReviewAccordion"
import TeacherGradingDecisionControls from "./TeacherGradingDecisionControls"

import { createTeacherGradingDecision } from "@/services/backend/teacher-grading-decisions"
import {
  AnswerRequiringAttentionWithTasks,
  NewTeacherGradingDecision,
} from "@/shared-module/common/bindings"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

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

const TopBar = styled.div`
  width: 100%;
  height: 108px;
  background: #1f6964;
  display: flex;
  align-items: center;
`

const AnswersRequiringAttentionItem: React.FC<Props> = ({
  answerRequiringAttention,
  exerciseMaxPoints,
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
        setUpdatedPoints(data.score_given)
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
        <TopBar>
          <ExclamationMessage
            size={64}
            className={css`
              color: white;
              margin: 1.5rem;
            `}
          />
          <div id="text-column">
            <p
              className={css`
                font-family: ${primaryFont};
                color: #f5f6f7cc;
                font-size: 16px;
                font-weight: 500;
                line-height: 16px;
                letter-spacing: 0em;
                margin-bottom: 0.5em;
              `}
            >
              {t("answered-at", {
                time: `${parseISO(answerRequiringAttention.created_at).toDateString()} ${parseISO(
                  answerRequiringAttention.created_at,
                ).toLocaleTimeString()}`,
              })}{" "}
            </p>
            <p
              className={css`
                font-family: ${primaryFont};
                font-size: 17px;
                font-weight: 400;
                line-height: 17px;
                letter-spacing: 0em;
                text-align: left;
                color: white;
              `}
            >
              {t("user-id")}: {answerRequiringAttention?.user_id}
            </p>
          </div>
          <div
            className={css`
              color: white;
              margin-left: auto;
              margin-right: 1em;
              font-size: 24px;
            `}
            id="point column"
          >
            <p
              className={css`
                text-transform: uppercase;
              `}
            >
              {t("points")}:{" "}
              {updatedPoints === null ? answerRequiringAttention.score_given : updatedPoints}/
              {exerciseMaxPoints}
            </p>
          </div>
        </TopBar>

        <p
          className={css`
            margin-top: 1.5em;
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

        <div>
          <StatusPanel>
            <div>
              <span
                className={css`
                  margin-left: 1em;
                  font-family: ${primaryFont};
                  color: #707070;
                `}
              >
                {t("status")}
              </span>
              <span
                className={css`
                  margin-left: 1em;
                  font-family: ${primaryFont};
                  color: #9a9a9a;
                `}
              >
                {answerRequiringAttention.grading_progress}
              </span>
            </div>
          </StatusPanel>

          <TeacherGradingDecisionControls
            userExerciseStateId={answerRequiringAttention.id}
            exerciseId={answerRequiringAttention.exercise_id}
            exerciseMaxPoints={exerciseMaxPoints}
            onGradingDecisionSubmit={handleGradingDecisionSubmit}
          />
        </div>
      </div>

      <div
        className={css`
          margin-bottom: 3rem;
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
    </>
  )
}

export default AnswersRequiringAttentionItem
