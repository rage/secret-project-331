/* oxlint-disable i18next/no-literal-string */

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import ParsedText from "../../ParsedText"

export interface SummaryOption {
  id: string
  text: string
  /** Render with markdown and LaTeX (multiple choice); plain text otherwise. */
  rich?: boolean
}

export const toSummaryOption = (
  o: { id: string; title?: string | null; body?: string | null },
  rich = false,
): SummaryOption => ({ id: o.id, text: o.title || o.body || "", rich })

export interface ChosenOption extends SummaryOption {
  /** null when the key does not say. */
  correct: boolean | null
}

export type SummaryLine2Label = "also-correct" | "correct-options" | "missed"

const LINE2_KEYS: Record<SummaryLine2Label, SummaryLabelKey> = {
  "also-correct": "answer-summary-also-correct",
  "correct-options": "answer-summary-correct-options",
  missed: "answer-summary-missed",
}

export interface SummaryInput {
  chosen: ChosenOption[]
  unselectedCorrect: SummaryOption[]
  incorrect: SummaryOption[]
  line2Label: SummaryLine2Label
}

export type SummaryLabelKey =
  | "answer-summary-you-chose"
  | "answer-summary-also-correct"
  | "answer-summary-correct-options"
  | "answer-summary-missed"
  | "answer-summary-incorrect-options"

export interface SummaryLine {
  labelKey: SummaryLabelKey
  options: (SummaryOption & { correct?: boolean | null; verdict?: boolean })[]
}

/** Lines in display order; empty lines are left out. */
export const buildSummary = ({
  chosen,
  unselectedCorrect,
  incorrect,
  line2Label,
}: SummaryInput): SummaryLine[] => {
  const lines: SummaryLine[] = [
    {
      labelKey: "answer-summary-you-chose",
      options: chosen.map((o) => ({ ...o, verdict: o.correct !== null })),
    },
    { labelKey: LINE2_KEYS[line2Label], options: unselectedCorrect },
    { labelKey: "answer-summary-incorrect-options", options: incorrect },
  ]
  return lines.filter((l) => l.options.length > 0)
}

export const SUMMARY_MODE = { single: "single", multi: "multi", chooseN: "choose-n" } as const

interface Line2Params {
  mode: (typeof SUMMARY_MODE)[keyof typeof SUMMARY_MODE]
  lenient?: boolean
  chosenCorrect: number
  n?: number
  totalCorrect: number
}

/** "Missed" only where the grading requires the option; otherwise it is "also correct" or the plain correct list. */
export const resolveLine2Label = ({
  mode,
  lenient,
  chosenCorrect,
  n,
  totalCorrect,
}: Line2Params): SummaryLine2Label => {
  if (mode === SUMMARY_MODE.chooseN) {
    return chosenCorrect >= Math.min(n ?? 0, totalCorrect) ? "also-correct" : "missed"
  }
  if (mode === SUMMARY_MODE.multi && !lenient) {
    return "missed"
  }
  return chosenCorrect > 0 ? "also-correct" : "correct-options"
}

const withDot = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`)

// A trailing period before "; " or a verdict is read aloud as "dot".
const withoutDot = (text: string): string => text.trimEnd().replace(/\.$/, "")

const OptionText: React.FC<{ option: SummaryOption; addDot: boolean }> = ({ option, addDot }) => {
  const text = addDot ? option.text : withoutDot(option.text)
  return option.rich ? (
    <ParsedText inline parseMarkdown parseLatex addDotToEnd={addDot} text={text} />
  ) : (
    <span>{addDot ? withDot(text) : text}</span>
  )
}

const boxStyles = css`
  margin-top: 1rem;
  padding: 0.75rem;
  box-sizing: border-box;
  overflow-wrap: anywhere;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 1.125rem;
  color: #4c5868;
`

const lineStyles = css`
  margin: 0 0 0.25rem 0;

  &:last-child {
    margin-bottom: 0;
  }
`

interface AnswerSummaryProps {
  lines: SummaryLine[]
}

/** Renders nothing when there are no lines. */
export const AnswerSummary: React.FC<AnswerSummaryProps> = ({ lines }) => {
  const { t } = useTranslation()
  if (lines.length === 0) {
    return null
  }
  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role=group on a styled div; fieldset alters layout
      role="group"
      aria-label={t("answer-summary")}
      className={boxStyles}
    >
      {lines.map((line) => (
        <p key={line.labelKey} className={lineStyles}>
          <strong>{t(line.labelKey)}</strong>{" "}
          {line.options.map((o, i) => {
            const last = i === line.options.length - 1
            // Line 1 ends with the verdict in brackets; the dot goes after it.
            const dotAfterVerdict = last && o.verdict
            return (
              <React.Fragment key={o.id}>
                <OptionText option={o} addDot={last && !o.verdict} />
                {o.verdict && (
                  <>
                    {" "}
                    {o.correct
                      ? t("answer-summary-verdict-correct")
                      : t("answer-summary-verdict-incorrect")}
                  </>
                )}
                {dotAfterVerdict && "."}
                {!last && t("answer-summary-list-separator")}
              </React.Fragment>
            )
          })}
        </p>
      ))}
    </div>
  )
}
