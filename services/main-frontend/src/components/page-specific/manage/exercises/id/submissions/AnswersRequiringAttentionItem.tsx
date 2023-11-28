import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { ExclamationMessage } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

import { updateAnswerRequiringAttention } from "../../../../../../services/backend/answers-requiring-attention"
import {
  AnswerRequiringAttentionWithTasks,
  NewTeacherGradingDecision,
  TeacherDecisionType,
} from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import ArrowDown from "../../../../../../shared-module/img/caret-arrow-down.svg"
import { primaryFont } from "../../../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../../../shared-module/styles/respond"
import SubmissionIFrame from "../../../../submissions/id/SubmissionIFrame"

import PeerReviewAccordion from "./PeerReviewAccordion"

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

const CustomPointPopup = css`
  background-color: #e2e4e6;
  padding: 2em;
  z-index: 5;
`

const TopBar = styled.div`
  width: 100%;
  height: 108px;
  background: #1f6964;
  display: flex;
  align-items: center;
`

const ControlPanel = styled.div`
  background: #f5f5f5;
  width: 100%;
  height: 150px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`

const PLACEMENT = "bottom"
const ARROW = "arrow"

const AnswersRequiringAttentionItem: React.FC<Props> = ({
  answerRequiringAttention,
  exerciseMaxPoints,
}) => {
  const { t } = useTranslation()
  const [updatedPoints, setUpdatedPoints] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [sliderValue, setSliderValue] = useState<number>(0)
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null)
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null)
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null)
  const submitMutation = useToastMutation(
    (update: NewTeacherGradingDecision) => {
      return updateAnswerRequiringAttention(update)
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

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: PLACEMENT,
    modifiers: [
      { name: ARROW, options: { element: arrowElement, padding: 10 } },
      {
        // eslint-disable-next-line i18next/no-literal-string
        name: "offset",
        options: {
          offset: [0, 20],
        },
      },
    ],
  })

  const doSubmitChange = async (
    user_exercise_state_id: string,
    exercise_id: string,
    action: TeacherDecisionType,
    value?: number | undefined,
  ) => {
    const manual_points = value !== undefined ? value : null
    submitMutation.mutate({
      user_exercise_state_id,
      exercise_id,
      action: action,
      manual_points: manual_points,
    })
  }

  const handleSubmitAndClose = (user_exercise_state_id: string, exercise_id: string) => {
    doSubmitChange(
      user_exercise_state_id,
      exercise_id,
      // eslint-disable-next-line i18next/no-literal-string
      "CustomPoints",
      sliderValue,
    )
    setOpen(false)
  }

  const handleOpenPopup = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault()
    setOpen(!open)
  }

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
                time: `${answerRequiringAttention?.created_at.toDateString()} ${answerRequiringAttention?.created_at.toLocaleTimeString()}`,
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
              {" "}
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
            {}
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
          <ControlPanel>
            <div
              className={css`
                margin-left: 1em;
              `}
            >
              <h3
                className={css`
                  color: #4b4b4b;
                  margin-bottom: 1rem;
                `}
              >
                {t("grading")}
              </h3>
            </div>
            <div
              className={css`
                display: flex;
                align-items: center;
              `}
            >
              <Button
                className={css`
                  font-family: ${primaryFont};
                  font-weight: 600;
                  font-size: 16px;
                  margin-left: 1em;
                  margin-right: 0.5em;
                `}
                size="medium"
                variant="reject"
                onClick={() =>
                  doSubmitChange(
                    answerRequiringAttention.id,
                    answerRequiringAttention.exercise_id,
                    // eslint-disable-next-line i18next/no-literal-string
                    "ZeroPoints",
                  )
                }
              >
                {t("button-text-zero-points")}
              </Button>
              <Button
                size="medium"
                variant="primary"
                className={css`
                  margin-right: 0.5em;
                `}
                onClick={() =>
                  doSubmitChange(
                    answerRequiringAttention.id,
                    answerRequiringAttention.exercise_id,
                    // eslint-disable-next-line i18next/no-literal-string
                    "FullPoints",
                  )
                }
              >
                {t("button-text-full-points")}
              </Button>
              <Button
                size="medium"
                variant="white"
                type="button"
                id="custom-point-button-v2"
                ref={setReferenceElement}
                onClick={handleOpenPopup}
              >
                {t("button-text-custom-points")}
                <ArrowDown
                  className={css`
                    transform: scale(1.2);
                    margin-left: 0.6em;
                    margin-bottom: 4px;
                  `}
                />
              </Button>
            </div>
          </ControlPanel>
        </div>
      </div>
      {open ? (
        <div
          id="custom-point-popup"
          ref={setPopperElement}
          className={cx(CustomPointPopup)}
          // eslint-disable-next-line react/forbid-dom-props
          style={styles.popper}
          {...attributes.popper}
        >
          {/* eslint-disable-next-line react/forbid-dom-props */}
          <div id="arrow" ref={setArrowElement} style={styles.arrow} />
          <div
            className={css`
              display: flex;
              flex-direction: row;
              margin-bottom: 1em;
              justify-content: space-evenly;
            `}
          >
            <div
              className={css`
                width: 100%;
                padding: 13px 0;
                align-self: strech;
              `}
            >
              <input
                className={css`
                  height: 4px;
                `}
                type="range"
                min="0"
                max="3"
                step={0.1}
                value={typeof sliderValue === "number" ? sliderValue : 0.0}
                onChange={(event) => setSliderValue(Number(event.target.value))}
                aria-labelledby="input-slider"
              />
            </div>

            <input
              className={css`
                margin-left: 1.5em;
                max-width: 4em;
                background: none;
                border: 0px;
                border-bottom: 1px solid black;
              `}
              value={sliderValue}
              onChange={(event) => setSliderValue(Number(event.target.value))}
              min="0.0"
              step={0.1}
              max="exerciseMaxPoints"
              type="number"
              // eslint-disable-next-line i18next/no-literal-string
              aria-labelledby="input-slider"
            />
          </div>
          <div>
            <Button
              type="button"
              variant="white"
              size="medium"
              onClick={(e) => {
                e.preventDefault()
                setOpen(!open)
              }}
            >
              {t("button-text-cancel")}
            </Button>
            <Button
              size="medium"
              variant="primary"
              disabled={
                sliderValue > exerciseMaxPoints ||
                sliderValue < 0 ||
                sliderValue.toString().length > exerciseMaxPoints.toString().length + 4
              }
              onClick={() =>
                handleSubmitAndClose(
                  answerRequiringAttention.id,
                  answerRequiringAttention.exercise_id,
                )
              }
            >
              {t("button-text-give-custom-points")}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={css`
          margin-bottom: 3rem;
        `}
      >
        <PeerReviewAccordion
          peerReviews={answerRequiringAttention.received_peer_reviews}
          title={t("received-peer-reviews-from-other-students")}
        />
      </div>
      <div>
        <PeerReviewAccordion
          peerReviews={answerRequiringAttention.given_peer_reviews}
          title={t("given-peer-reviews-to-other-students")}
        />
      </div>
    </>
  )
}

export default AnswersRequiringAttentionItem
