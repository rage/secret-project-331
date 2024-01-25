import { css } from "@emotion/css"
import React from "react"

import { ExerciseFeedback } from "../pages/api/grade"
import { baseTheme } from "../shared-module/common/styles"
import { Answer, ModelSolutionApi, PublicAlternative } from "../util/stateInterfaces"

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

        // eslint-disable-next-line i18next/no-literal-string
        const border = optionIsCorrect !== undefined ? `4px solid ${color}` : "none"
        return (
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
