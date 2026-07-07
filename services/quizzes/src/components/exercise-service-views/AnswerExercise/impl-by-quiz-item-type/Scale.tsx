"use client"

import { css } from "@emotion/css"
import { useRadioGroupState } from "@react-stately/radio"
import type { RadioGroupState } from "@react-stately/radio"
import React, { useRef } from "react"
import { mergeProps, useFocusRing, useRadio, useRadioGroup, VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { UserItemAnswerScale } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemScale } from "../../../../../types/quizTypes/publicSpec"
import ParsedText from "../../../ParsedText"

import { QUIZ_TITLE_STYLE } from "./AnswerQuizStyles"

import { QuizItemComponentProps } from "."

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const optionStyle = css`
  display: flex;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
  line-height: 1.2;
  width: fit-content;

  ${respondToOrLarger.sm} {
    width: 5rem;
  }
`

const optionValueStyle = css`
  color: #4c5868;
  font-size: 1.125rem;
  min-width: 1.25em;
`

const optionCircleStyle = css`
  display: inline-block;
  box-sizing: border-box;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  background-color: #fff;
  margin-left: 0.375em;
  transition: 0.25s ease;
  /* Gray 400 from the design system: >= 3:1 contrast against white (WCAG 1.4.11) */
  box-shadow: inset 0 0 0 0.15em ${baseTheme.colors.gray[400]};

  &[data-selected="true"] {
    box-shadow: inset 0 0 0 0.371rem #627ba7;
    border: 0.188rem solid #718dbf;
  }

  &[data-focus-visible="true"] {
    outline: 3px solid #2d4a7f;
    outline-offset: 2px;
  }
`

interface ScaleRadioProps {
  value: string
  state: RadioGroupState
}

const ScaleRadio: React.FC<ScaleRadioProps> = ({ value, state }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const { inputProps, isSelected } = useRadio({ value, children: value }, state, inputRef)
  const { focusProps, isFocusVisible } = useFocusRing()

  return (
    <label className={optionStyle}>
      <VisuallyHidden>
        <input {...mergeProps(inputProps, focusProps)} ref={inputRef} />
      </VisuallyHidden>
      <span className={optionValueStyle}>{value}</span>
      <span
        aria-hidden="true"
        className={optionCircleStyle}
        data-selected={String(isSelected)}
        data-focus-visible={String(isFocusVisible)}
      />
    </label>
  )
}

const Scale: React.FC<QuizItemComponentProps<PublicSpecQuizItemScale, UserItemAnswerScale>> = ({
  quizItem,
  quizItemAnswerState,
  setQuizItemAnswerState,
}) => {
  const { t } = useTranslation()
  const minValue = quizItem.minValue ?? 1
  const maxValue = quizItem.maxValue ?? 7

  const handleOptionSelect = (selectedOption: string) => {
    if (!quizItemAnswerState) {
      setQuizItemAnswerState({
        quizItemId: quizItem.id,
        intData: Number(selectedOption),
        valid: true,
        type: "scale",
      })
      return
    }

    setQuizItemAnswerState({ ...quizItemAnswerState, intData: Number(selectedOption), valid: true })
  }

  const state = useRadioGroupState({
    value: quizItemAnswerState?.intData != null ? String(quizItemAnswerState.intData) : null,
    onChange: handleOptionSelect,
  })
  const { radioGroupProps, labelProps } = useRadioGroup(
    {
      label: quizItem.title || undefined,
      "aria-label": quizItem.title ? undefined : t("answer"),
    },
    state,
  )

  return (
    <div
      {...radioGroupProps}
      className={css`
        display: flex;
        flex: 1;
        min-width: 100%;
        padding: 0.625rem;
        flex-direction: column;
        margin-bottom: 0.625rem;
        background: white;
        ${respondToOrLarger.md} {
          flex-direction: row;
          flex-wrap: wrap;
        }
      `}
    >
      {quizItem.title && (
        <div
          {...labelProps}
          className={css`
            ${QUIZ_TITLE_STYLE}
            ${respondToOrLarger.md} {
              text-align: left;
            }
          `}
        >
          <ParsedText inline parseLatex parseMarkdown text={quizItem.title} />
        </div>
      )}
      <div
        className={css`
          display: flex;
          flex-direction: column;
          row-gap: 1rem;
          column-gap: 0;
          list-style: none;
          padding: 0;

          ${respondToOrLarger.sm} {
            flex-direction: row;
            flex-wrap: wrap;
          }
        `}
      >
        {Array.from({ length: maxValue - minValue + 1 }, (_, i) => {
          const value = (i + minValue).toString()
          return <ScaleRadio key={value} value={value} state={state} />
        })}
      </div>
    </div>
  )
}

export default withErrorBoundary(Scale)
