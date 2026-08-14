"use client"

import { css } from "@emotion/css"
import React, { useId } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

import type { MultipleChoiceQuestion } from "./multipleChoiceQuestions"
import { LIGHT_GREEN } from "./styles"

interface MultipleChoiceQuestionBubbleProps {
  question: MultipleChoiceQuestion
  /**
   * Whether the question is still waiting for the learner. A closed one keeps its place in the
   * conversation as a record of what was asked, so the chatbot's next message does not read as if
   * it came out of nowhere.
   */
  isOpen: boolean
  /** While true no choice can be activated, so a second click cannot answer the same call twice. */
  isAnswering: boolean
  onChoose: (choiceIndex: number) => void
}

const bubbleStyle = (isOpen: boolean) => css`
  align-self: flex-start;
  margin: 0.5rem 2rem 0.5rem 0;
  padding: 1rem;
  border-radius: 10px;
  max-width: stretch;
  overflow-wrap: break-word;
  ${isOpen
    ? `
      background-color: ${LIGHT_GREEN};
      border: 2px solid ${baseTheme.colors.green[300]};
    `
    : `
      background-color: ${baseTheme.colors.gray[100]};
      border: 2px solid ${baseTheme.colors.gray[200]};
      color: ${baseTheme.colors.gray[600]};
    `}
`

const questionStyle = css`
  margin: 0;
  font-weight: 600;
`

const hintStyle = css`
  margin: 0.25rem 0 0.75rem;
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[500]};
`

const choicesStyle = css`
  display: flex;
  flex-flow: row wrap;
  gap: 0.5rem;
`

const choiceStyle = css`
  flex: 1 1 12rem;
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

  &:hover:not(:disabled) {
    filter: brightness(0.96) contrast(1.05);
  }
`

const offeredChoicesStyle = css`
  margin: 0.5rem 0 0;
  padding-left: 1.5rem;
  font-size: 0.9rem;
`

/** A clarifying question the chatbot suspended its turn on, with the choices it offered. */
const MultipleChoiceQuestionBubble: React.FC<MultipleChoiceQuestionBubbleProps> = ({
  question,
  isOpen,
  isAnswering,
  onChoose,
}) => {
  const { t } = useTranslation()
  const questionId = useId()

  return (
    <div
      className={bubbleStyle(isOpen)}
      role="group"
      aria-labelledby={questionId}
      aria-busy={isOpen && isAnswering}
    >
      <p id={questionId} className={questionStyle}>
        {question.question}
      </p>
      <p className={hintStyle}>
        {isOpen ? t("chatbot-question-pick-an-answer") : t("chatbot-question-closed")}
      </p>
      {isOpen ? (
        <div className={choicesStyle}>
          {question.choices.map((choice, choiceIndex) => (
            <button
              key={choiceIndex}
              type="button"
              className={choiceStyle}
              disabled={isAnswering}
              onClick={() => onChoose(choiceIndex)}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <ul className={offeredChoicesStyle}>
          {question.choices.map((choice, choiceIndex) => (
            <li key={choiceIndex}>{choice}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MultipleChoiceQuestionBubble
