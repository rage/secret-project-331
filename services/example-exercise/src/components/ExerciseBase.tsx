import { css } from "@emotion/css"

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
        return (
          <div key={option.id}>
            <button
              className={
                interactable
                  ? css`
                      width: 97%;
                      display: inline;
                      float: right;
                      padding: 1rem 2rem;
                      background-color: ${selected ? "#4210f5" : "#6188ff"};
                      border-radius: 1rem;
                      border: 0;
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
                      display: inline;
                      padding: 1rem 2rem;
                      width: 97%;
                      background-color: ${selected ? "#4210f5" : "#6188ff"};
                      border-radius: 1rem;
                      border: 0;
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
            <div
              className={css`
                display: sticky;
                height: 70px;
                width: 8px;
                float: right;
                margin-right: 10px;
                background-color: ${correct ? "green" : "red"};
              `}
            />
          </div>
        )
      })}
    </div>
  )
}

export default ExerciseBase
