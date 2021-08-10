import { css } from "@emotion/css"

import { baseTheme } from "../shared-module/utils/theme"
import { PublicAlternative } from "../util/stateInterfaces"
interface Props {
  alternatives: PublicAlternative[]
  selectedId: string | null
  maxWidth: number | null
  onClick: (selectedId: string) => void
  interactable: boolean
  model_solutions: Array<string>
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
        const selected = selectedId === option.id
        const correct = model_solutions.includes(option.id)
        const hasSolutions = model_solutions.length > 0
        const green = baseTheme.colors.green[100]
        const red = baseTheme.colors.red[100]
        return (
          <button
            className={
              interactable
                ? css`
                    float: right;
                    padding: 1rem 2rem;
                    background-color: ${selected ? "#4210f5" : "#6188ff"};
                    border-radius: 1rem;
                    border: ${!hasSolutions ? `0` : `4px solid ${correct ? green : red}`};
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
                    background-color: ${selected ? "#4210f5" : "#6188ff"};
                    border-radius: 1rem;
                    border: ${!hasSolutions ? `0` : `4px solid ${correct ? green : red}`};
                    color: white;
                    margin-top: 0.5rem;
                    margin-bottom: 0.5rem;
                  `
            }
            aria-selected={selected}
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
