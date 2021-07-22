import { css } from "@emotion/css"

import { PublicAlternative } from "../util/stateInterfaces"

interface Props {
  alternatives: PublicAlternative[]
  selectedId: string | null
  maxWidth: number | null
  onClick: (selectedId: string) => void
  interactable: boolean
}

const ExerciseBase: React.FC<Props> = ({
  maxWidth,
  alternatives,
  selectedId,
  onClick,
  interactable,
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
        return (
          <button
            className={
              interactable
                ? css`
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
                    padding: 1rem 2rem;
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
        )
      })}
    </div>
  )
}

export default ExerciseBase
