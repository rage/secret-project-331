import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "@/styles/theme"
import type {
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
      {publicSpec.map((option) => {
        const selected = answer.selectedOptionId === option.id
        const optionIsCorrect = modelSolutionSpec?.correctOptionIds.includes(option.id)

        let color = ""
        if (optionIsCorrect !== undefined) {
          color = optionIsCorrect ? GREEN : RED
        }

        // oxlint-disable-next-line i18next/no-literal-string
        const border = optionIsCorrect !== undefined ? `4px solid ${color}` : "none"
        return (
          <button
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- styled button acting as a checkbox; an <input> cannot contain child content
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
            key={option.id}
          >
            {option.name}
          </button>
        )
      })}
    </div>
  )
}

export default Submission
