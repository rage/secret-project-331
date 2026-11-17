/* oxlint-disable i18next/no-literal-string */

import { css, cx } from "@emotion/css"
import React from "react"

import { quizTheme } from "../../../styles/QuizStyles"

const MARKER_COLOR = "#4c5868"

export const optionBoxStyles = css`
  align-items: center;
  background: ${quizTheme.quizItemBackground};
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  margin: 0.3rem 0;
  padding: 0 1rem;
  border-radius: 0.375rem;
  font-size: 1.125rem;
  color: ${MARKER_COLOR};
  border: 0.125rem solid #d8d8d8;
`

/** Marker and text stay on one line; the chip wraps under the whole label. */
export const optionLabelStyles = css`
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
`

export const optionTextStyles = css`
  flex: 1 1 auto;
  min-width: 0;
  padding: 0.8rem 0;
  max-width: 50ch;
`

const tints = {
  correct: css`
    background: ${quizTheme.gradingCorrectItemBackground};
    border-color: #69af8a;
  `,
  wrong: css`
    background: ${quizTheme.gradingWrongItemBackground};
    border-color: #f5d0d3;
  `,
  unknown: css`
    background: ${quizTheme.gradingSelectedItemBackground};
    border-color: ${quizTheme.gradingSelectedItemBorderColor};
  `,
}

/** Tint classes for a selected option; unselected options get none. */
export const optionStateStyles = (correct: boolean | null): string =>
  correct === true ? tints.correct : correct === false ? tints.wrong : tints.unknown

/** Key true wins, then non-null feedback, then the key value, else null (unknown). */
export const resolveOptionCorrectness = (
  modelOption: { correct?: boolean | null } | null | undefined,
  feedbackOption: { this_option_was_correct?: boolean | null } | null | undefined,
): boolean | null => {
  let correct = modelOption?.correct ?? null
  if (
    feedbackOption &&
    feedbackOption.this_option_was_correct !== null &&
    feedbackOption.this_option_was_correct !== undefined &&
    !correct
  ) {
    correct = feedbackOption.this_option_was_correct
  }
  return correct
}

/** Selected option of a single-select item: per-option correctness, else the item's score (null if unknown). */
export const resolveSelectedOptionCorrectness = (
  modelOption: { correct?: boolean | null } | null | undefined,
  feedbackOption: { this_option_was_correct?: boolean | null } | null | undefined,
  itemFeedback:
    | { score?: number | null; correctnessCoefficient?: number | null }
    | null
    | undefined,
): boolean | null => {
  const optionCorrect = resolveOptionCorrectness(modelOption, feedbackOption)
  if (optionCorrect !== null) {
    return optionCorrect
  }
  if (itemFeedback?.score === 1 || itemFeedback?.correctnessCoefficient === 1) {
    return true
  }
  return itemFeedback?.score === 0 ? false : null
}

interface OptionMarkerProps {
  selected: boolean
  multi: boolean
}

const CheckGlyph: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" focusable="false">
    <path
      d="M5 12.5l4.5 4.5L19 7.5"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/** Fixed-width slot on every row; the check is drawn only when selected. */
export const OptionMarker: React.FC<OptionMarkerProps> = ({ selected, multi }) => (
  <span
    aria-hidden="true"
    className={css`
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
      margin-right: 0.75rem;
    `}
  >
    {selected &&
      (multi ? (
        <span
          className={css`
            display: flex;
            align-items: center;
            justify-content: center;
            width: 1.25rem;
            height: 1.25rem;
            background: ${MARKER_COLOR};
            border-radius: 0.25rem;
          `}
        >
          <CheckGlyph size={16} color="#fff" />
        </span>
      ) : (
        <CheckGlyph size={20} color={MARKER_COLOR} />
      ))}
  </span>
)

export const CHIP = { correct: "correct", wrong: "wrong", outlined: "outlined" } as const

export type OptionChipKind = (typeof CHIP)[keyof typeof CHIP]

const chipBase = css`
  flex: 0 0 auto;
  /* Marker slot plus gap, so a wrapped chip lines up with the text. */
  margin-left: 2rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: bold;
  padding: 0.3125rem 0.375rem 0.25rem 0.375rem;
  border-radius: 0.125rem;
  white-space: nowrap;
`

const chipKinds: Record<OptionChipKind, string> = {
  correct: css`
    background: #9dc7b1;
    color: #14261c;
  `,
  wrong: css`
    background: #eedbdd;
    color: #b12632;
  `,
  // Border width is taken off the vertical padding so the height matches the filled chips.
  outlined: css`
    background: transparent;
    color: ${MARKER_COLOR};
    border: 0.0625rem solid #767676;
    padding: 0.25rem 0.3125rem 0.1875rem 0.3125rem;
  `,
}

export const OptionChip: React.FC<{ kind: OptionChipKind; children: React.ReactNode }> = ({
  kind,
  children,
}) => <div className={cx(chipBase, chipKinds[kind])}>{children}</div>
