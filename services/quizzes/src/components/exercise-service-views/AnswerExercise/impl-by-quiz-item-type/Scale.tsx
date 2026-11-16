import { css, cx } from "@emotion/css"
import { useRadioGroupState } from "@react-stately/radio"
import type { RadioGroupState } from "@react-stately/radio"
import React, { useId, useRef } from "react"
import { mergeProps, useFocusRing, useRadio, useRadioGroup, VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { QuizItemComponentProps } from "."
import type { UserItemAnswerScale } from "../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItemScale } from "../../../../../types/quizTypes/publicSpec"
import ParsedText from "../../../ParsedText"
import { QUIZ_TITLE_STYLE } from "./AnswerQuizStyles"

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

const optionDisabledStyle = css`
  cursor: default;
`

const labelTextStyle = css`
  color: #4c5868;
  font-size: 1rem;
  margin: 0.25rem 0;
`

const isRealLabel = (label: string | null | undefined): label is string =>
  Boolean(label) && label !== "?"

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
  /* gray[400] for sufficient contrast against white */
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
    <label className={cx(optionStyle, state.isDisabled && optionDisabledStyle)}>
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

interface ScaleViewProps {
  quizItem: PublicSpecQuizItemScale
  selectedValue: number | null | undefined
  onSelect?: (value: number) => void
  disabled?: boolean
}

/** Radio scale shared by the answer and results views. */
export const ScaleView: React.FC<ScaleViewProps> = ({
  quizItem,
  selectedValue,
  onSelect,
  disabled = false,
}) => {
  const { t } = useTranslation()
  const minValue = quizItem.minValue ?? 1
  const maxValue = quizItem.maxValue ?? 7
  const bodyId = useId()
  const minLabelId = useId()
  const maxLabelId = useId()
  const hasBody = isRealLabel(quizItem.body)
  const hasMinLabel = isRealLabel(quizItem.minLabel)
  const hasMaxLabel = isRealLabel(quizItem.maxLabel)

  const state = useRadioGroupState({
    value: selectedValue !== null && selectedValue !== undefined ? String(selectedValue) : null,
    onChange: (selectedOption: string) => onSelect?.(Number(selectedOption)),
    isDisabled: disabled,
  })
  const describedBy =
    [hasBody && bodyId, hasMinLabel && minLabelId, hasMaxLabel && maxLabelId]
      .filter(Boolean)
      .join(" ") || undefined
  const { radioGroupProps, labelProps } = useRadioGroup(
    {
      ...(quizItem.title ? { label: quizItem.title } : { "aria-label": t("answer") }),
      ...(describedBy ? { "aria-describedby": describedBy } : {}),
      isDisabled: disabled,
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
      {hasBody && (
        <div id={bodyId} className={labelTextStyle}>
          <ParsedText inline parseLatex parseMarkdown text={quizItem.body} />
        </div>
      )}
      {hasMinLabel && (
        <div id={minLabelId} className={labelTextStyle}>
          {minValue}: {quizItem.minLabel}
        </div>
      )}
      {hasMaxLabel && (
        <div id={maxLabelId} className={labelTextStyle}>
          {maxValue}: {quizItem.maxLabel}
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

const Scale: React.FC<QuizItemComponentProps<PublicSpecQuizItemScale, UserItemAnswerScale>> = ({
  quizItem,
  quizItemAnswerState,
  setQuizItemAnswerState,
}) => {
  const handleOptionSelect = (selected: number) => {
    if (!quizItemAnswerState) {
      setQuizItemAnswerState({
        quizItemId: quizItem.id,
        intData: selected,
        valid: true,
        type: "scale",
      })
      return
    }

    setQuizItemAnswerState({ ...quizItemAnswerState, intData: selected, valid: true })
  }

  return (
    <ScaleView
      quizItem={quizItem}
      selectedValue={quizItemAnswerState?.intData}
      onSelect={handleOptionSelect}
    />
  )
}

export default withErrorBoundary(Scale)
