"use client"

import { css, cx } from "@emotion/css"
import { CheckCircle } from "@vectopus/atlas-icons-react"
import React, { useId, useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

import type { ClientToolBubbleProps } from "./clientToolRegistry"
import { chosenChoiceIndex, multipleChoiceAnswer } from "./multipleChoiceQuestions"
import type { MultipleChoiceQuestion } from "./multipleChoiceQuestions"

type MultipleChoiceQuestionBubbleProps = ClientToolBubbleProps<MultipleChoiceQuestion>

type BubbleVisualState =
  /** Still waiting for the learner to pick something. */
  | "open"
  /** Answered, whether or not the server has confirmed it yet. Not "closed": the learner did
   * something here, so it should read as settled rather than as a dead end. */
  | "answered"
  /** Closed without an answer: aborted by a message the learner sent instead. */
  | "aborted"

// `baseTheme.colors.green`'s own pale tints (75-200) are so desaturated they read as near-white,
// indistinguishable from an equally pale gray at a glance. A visible tint still made of that same
// theme color comes from lowering its opacity instead of picking a paler step of the scale.
const QUESTION_TINT_STRONG = `${baseTheme.colors.green[400]}26`
const QUESTION_TINT_FAINT = `${baseTheme.colors.green[400]}14`

const bubbleBaseStyle = css`
  align-self: flex-start;
  /* Without an explicit width the bubble shrink-wraps to the choice grid's minimum content size,
     which leaves the grid's fr track nothing to expand into: every choice collapses to
     MIN_CHOICE_WIDTH and the grid never reaches two columns. */
  width: min(48rem, 100%);
  margin: 0.5rem 2rem 0.5rem 0;
  padding: 1rem;
  border-radius: 10px;
  overflow-wrap: break-word;
  /* Lets the choice grid below query this bubble's own rendered width rather than the viewport's:
     the same question can render at 500px in the dialog or far narrower embedded in a course
     material block, and only the former would ever match a viewport media query. */
  container-type: inline-size;
`

// Hoisted per state because emotion re-serializes and re-hashes the result on every css call, and
// this bubble re-renders with each streamed token.
const BUBBLE_CLASS_BY_VISUAL_STATE: Record<BubbleVisualState, string> = {
  open: cx(
    bubbleBaseStyle,
    css`
      background-color: ${QUESTION_TINT_STRONG};
      border: 2px solid ${baseTheme.colors.green[400]};
    `,
  ),
  answered: cx(
    bubbleBaseStyle,
    css`
      background-color: ${QUESTION_TINT_FAINT};
      border: 2px solid ${baseTheme.colors.green[300]};
    `,
  ),
  aborted: cx(
    bubbleBaseStyle,
    css`
      background-color: ${baseTheme.colors.gray[100]};
      border: 2px solid ${baseTheme.colors.gray[200]};
      color: ${baseTheme.colors.gray[600]};
    `,
  ),
}

const questionStyle = css`
  margin: 0;
  font-weight: 600;
`

const hintStyle = css`
  margin: 0.25rem 0 0.75rem;
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[500]};
`

// A choice needs to stay at least this wide, or a short word ("morning", "afternoon") wraps onto
// a line of its own rather than sharing one with its neighbors.
const MIN_CHOICE_WIDTH = "9rem"

// A fixed two-column grid instead of flex-wrap, whose column count used to depend on how much of
// each choice's text happened to fit at the current width. A lone last choice from an odd-sized
// question spans both columns rather than sitting alone next to empty space.
const choicesStyle = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(${MIN_CHOICE_WIDTH}, 1fr));
  gap: 0.5rem;

  /* Below this, two columns of MIN_CHOICE_WIDTH each no longer both fit. */
  @container (max-width: 20rem) {
    grid-template-columns: minmax(${MIN_CHOICE_WIDTH}, 1fr);
  }
`

const choiceStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  text-align: start;
  padding: 0.6rem 0.8rem;
  border: 1px solid ${baseTheme.colors.green[400]};
  border-radius: 8px;
  background-color: ${baseTheme.colors.clear[50]};
  color: ${baseTheme.colors.gray[700]};
  cursor: pointer;
  transition: filter 0.2s;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[600]};
    outline-offset: 2px;
  }

  &:hover:not(:disabled) {
    filter: brightness(0.96) contrast(1.05);
  }

  &:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }
`

// Kept at full opacity, unlike a merely-disabled choice, so it reads as "this is the answer" and
// not as "this option is unavailable".
const selectedChoiceStyle = css`
  border-color: ${baseTheme.colors.green[600]};
  background-color: ${QUESTION_TINT_STRONG};
  color: ${baseTheme.colors.green[700]};
  font-weight: 600;

  &:disabled {
    opacity: 1;
  }
`

// Hoisted for the same reason as the bubble classes above.
const selectedChoiceClass = cx(choiceStyle, selectedChoiceStyle)

const checkmarkStyle = css`
  flex: none;
  width: 1.1rem;
  height: 1.1rem;
  color: ${baseTheme.colors.green[600]};
`

/** A clarifying question the chatbot suspended its turn on, with the choices it offered. */
const MultipleChoiceQuestionBubble: React.FC<MultipleChoiceQuestionBubbleProps> = ({
  toolCallId,
  call: question,
  isOpen,
  isTurnInFlight,
  closedAnswer,
  onAnswer,
}) => {
  const { t } = useTranslation()
  const questionId = useId()

  // Set the moment the learner clicks, before the server confirms it, so the choice highlights at
  // once; the stored answer takes over once the call closes, including after a reload where this
  // starts null.
  const [locallyChosenChoiceIndex, setLocallyChosenChoiceIndex] = useState<number | null>(null)
  // The stored answer, once the call is closed, is authoritative even over a fresher local click:
  // it is what a reload will show, so the two must agree in every other case too.
  const selectedChoiceIndex =
    closedAnswer !== undefined
      ? chosenChoiceIndex(question, closedAnswer.value)
      : locallyChosenChoiceIndex

  const isAnswered = selectedChoiceIndex !== null
  // Locked in the moment a choice is picked, even before the server confirms it: a second click
  // could otherwise answer the same call twice.
  const choicesDisabled = !isOpen || isTurnInFlight || isAnswered
  // oxlint-disable-next-line i18next/no-literal-string -- an internal state tag, never rendered
  const visualState: BubbleVisualState = isAnswered ? "answered" : isOpen ? "open" : "aborted"

  const handleChoiceClick = (choiceIndex: number) => {
    setLocallyChosenChoiceIndex(choiceIndex)
    onAnswer(toolCallId, multipleChoiceAnswer(choiceIndex))
  }

  return (
    <div
      className={BUBBLE_CLASS_BY_VISUAL_STATE[visualState]}
      role="group"
      aria-labelledby={questionId}
      aria-busy={isOpen && isTurnInFlight && !isAnswered}
    >
      <p id={questionId} className={questionStyle}>
        {question.question}
      </p>
      <p className={hintStyle}>
        {isAnswered
          ? t("chatbot-question-answered")
          : isOpen
            ? t("chatbot-question-pick-an-answer")
            : t("chatbot-question-closed")}
      </p>
      <div className={choicesStyle}>
        {question.choices.map((choice, choiceIndex) => {
          const isSelected = selectedChoiceIndex === choiceIndex
          return (
            <button
              key={choiceIndex}
              type="button"
              className={isSelected ? selectedChoiceClass : choiceStyle}
              disabled={choicesDisabled}
              aria-pressed={isAnswered ? isSelected : undefined}
              onClick={() => handleChoiceClick(choiceIndex)}
            >
              <span>{choice}</span>
              {isSelected && (
                <>
                  <VisuallyHidden>{t("chatbot-question-your-answer")}</VisuallyHidden>
                  <CheckCircle aria-hidden="true" className={checkmarkStyle} />
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MultipleChoiceQuestionBubble
