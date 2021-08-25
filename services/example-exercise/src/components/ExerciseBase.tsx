import { css } from "@emotion/css"

import { baseTheme } from "../shared-module/styles/theme"
import { PublicAlternative } from "../util/stateInterfaces"
interface Props {
  alternatives: PublicAlternative[]
  selectedId: string | null
  maxWidth: number | null
  onClick: (selectedId: string) => void
  interactable: boolean
  model_solutions: string[] | null
}

const ExerciseBase: React.FC<Props> = ({
  maxWidth,
  alternatives,
  selectedId,
  onClick,
  interactable,
  model_solutions,
}) => {
  return (
    <div
      className={css`
        width: 100%;
        ${maxWidth && `max-width: ${maxWidth}px;`}
        margin: 0 auto;
        display: flex;
        flex-direction: column;
      `}
    >
      {alternatives.map((option) => {
        let correct = false
        if (model_solutions) {
          correct = model_solutions.includes(option.id)
        }
        const selected = selectedId === option.id
        // Border colors
        const green = baseTheme.colors.green[300]
        const red = baseTheme.colors.red[300]
        // Background of the buttons
        const color = "#6188ff"
        const chosenColor = "#4210f5"
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
                    color: white;
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
            onClick={() => onClick(option.id)}
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
