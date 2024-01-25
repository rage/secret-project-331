import { css } from "@emotion/css"

import { baseTheme } from "../shared-module/common/styles/theme"
import { ModelSolutionApi, PublicAlternative } from "../util/stateInterfaces"
interface Props {
  alternatives: PublicAlternative[]
  selectedId: string | null
  onClick: (selectedId: string, name: string) => void
  interactable: boolean
  model_solutions: ModelSolutionApi | null
}

const ExerciseBase: React.FC<React.PropsWithChildren<Props>> = ({
  alternatives,
  selectedId,
  onClick,
  interactable,
  model_solutions,
}) => {
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
      `}
    >
      {alternatives.map((option) => {
        let correct = false
        if (model_solutions) {
          correct = model_solutions.correctOptionIds.includes(option.id)
        }
        const selected = selectedId === option.id
        // Border colors
        const green = baseTheme.colors.green[400]
        const red = baseTheme.colors.red[300]
        // Background of the buttons
        const color = baseTheme.colors.blue[300]
        const chosenColor = baseTheme.colors.blue[700]
        // eslint-disable-next-line i18next/no-literal-string
        const border = model_solutions ? `4px solid ${correct ? green : red}` : `0`
        return (
          <button
            role="checkbox"
            className={
              interactable
                ? css`
                    float: right;
                    padding: 1rem 2rem;
                    background-color: ${selected ? chosenColor : color};
                    border-radius: 1rem;
                    border: ${border};
                    color: ${selected
                      ? baseTheme.colors.primary[100]
                      : baseTheme.colors.primary[200]};
                    transition: all 0.3s;
                    cursor: pointer;
                    margin-top: 0.5rem;
                    margin-bottom: 0.5rem;
                    &:hover {
                      background-color: ${interactable
                        ? selected
                          ? "#330eb8"
                          : "#507afb"
                        : "#6188ff"};
                    }
                  `
                : css`
                    padding: 1rem 2rem;
                    background-color: ${selected ? chosenColor : color};
                    border-radius: 1rem;
                    border: ${border};
                    color: white;
                    margin-top: 0.5rem;
                    margin-bottom: 0.5rem;
                  `
            }
            aria-checked={selected}
            onClick={() => onClick(option.id, option.name)}
            key={option.id}
          >
            {option.name}
          </button>
        )
      })}
    </div>
  )
}

export default ExerciseBase
