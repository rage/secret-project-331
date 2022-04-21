import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "../shared-module/styles"
import { ModelSolutionApi, PublicAlternative } from "../util/stateInterfaces"

interface SubmissionProps {
  port: MessagePort
  publicAlternatives: PublicAlternative[]
  selectedId: string | undefined
  selectedOptionIsCorrect: boolean | null
  modelSolutions: ModelSolutionApi | null
}

const Submission: React.FC<SubmissionProps> = ({
  publicAlternatives,
  selectedId,
  modelSolutions,
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
      {publicAlternatives.map((option) => {
        const selected = selectedId === option.id
        const optionIsCorrect = modelSolutions?.correctOptionIds.includes(option.id)

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
