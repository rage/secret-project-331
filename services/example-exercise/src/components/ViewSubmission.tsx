import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/styles/theme"
import {
  Answer,
  ExerciseFeedback,
  ModelSolutionApi,
  PublicAlternative,
} from "@/util/stateInterfaces"

interface SubmissionProps {
  port: MessagePort
  publicSpec: PublicAlternative[]
  answer: Answer
  gradingFeedback: ExerciseFeedback | null
  modelSolutionSpec: ModelSolutionApi | null
}

const Submission: React.FC<React.PropsWithChildren<SubmissionProps>> = ({
  publicSpec,
  modelSolutionSpec,
  answer,
}) => {
  const { t } = useTranslation()

  // Border colors
  const GREEN = baseTheme.colors.green[300]
  const RED = baseTheme.colors.red[300]

  const COLOR = baseTheme.colors.blue[300]
  const CHOSEN_COLOR = baseTheme.colors.blue[700]

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
      `}
    >
      {publicSpec.map((option, index) => {
        const selected = answer.selectedOptionId === option.id
        const optionIsCorrect = modelSolutionSpec?.correctOptionIds.includes(option.id)

        let color = ""
        if (optionIsCorrect !== undefined) {
          color = optionIsCorrect ? GREEN : RED
        }

        // eslint-disable-next-line i18next/no-literal-string
        const border = optionIsCorrect !== undefined ? `4px solid ${color}` : "none"
        // Correctness must not rely on color alone (WCAG 1.4.1): pair it with an icon and a
        // localized text label rendered on the light surface, where the semantic tokens meet AA.
        const statusColor = optionIsCorrect
          ? baseTheme.semantic.success.text
          : baseTheme.semantic.error.text
        // Decorative glyph; the adjacent localized text ("Correct"/"Incorrect") is the real cue.
        // eslint-disable-next-line i18next/no-literal-string
        const statusIcon = optionIsCorrect ? "✓" : "✗"
        return (
          <div
            key={option.id}
            className={css`
              display: flex;
              align-items: center;
              gap: 0.75rem;
            `}
          >
            <button
              role="checkbox"
              className={css`
                padding: 1rem 2rem;
                background-color: ${selected ? CHOSEN_COLOR : COLOR};
                border-radius: 1rem;
                border: ${border};
                color: ${selected ? baseTheme.colors.primary[100] : baseTheme.colors.primary[200]};
                margin-top: 0.5rem;
                margin-bottom: 0.5rem;
              `}
              aria-checked={selected}
            >
              {option.name || t("option-n", { n: index + 1 })}
            </button>
            {optionIsCorrect !== undefined && (
              <span
                className={css`
                  display: inline-flex;
                  align-items: center;
                  gap: 0.25rem;
                  font-weight: 600;
                  color: ${statusColor};
                `}
              >
                <span aria-hidden="true">{statusIcon}</span>
                {optionIsCorrect ? t("correct") : t("incorrect")}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default Submission
