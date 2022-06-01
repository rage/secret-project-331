import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../../../shared-module/styles"

export interface ModuleProgressProps {
  exercisesAnswered: string | number
  exercisesNeededToAnswer: string | number
  totalExercises: string | number
}

const ModuleProgress: React.FC<ModuleProgressProps> = ({
  exercisesAnswered,
  exercisesNeededToAnswer,
  totalExercises,
}) => {
  const { t } = useTranslation()
  return (
    <>
      <HilightContainer>
        <HighlightItem
          highlightColor={baseTheme.colors.green[700]}
          highlightDescription={t("exercises-answered")}
          highlightText={exercisesAnswered}
          leftBorder={false}
        />
        <HighlightItem
          highlightColor={baseTheme.colors.blue[700]}
          highlightDescription={t("exercises-required-for-completion")}
          highlightText={exercisesNeededToAnswer}
          leftBorder={true}
        />
        <HighlightItem
          highlightColor={baseTheme.colors.grey[700]}
          highlightDescription={t("total-exercises")}
          highlightText={totalExercises}
          leftBorder={true}
        />
      </HilightContainer>
    </>
  )
}

export default ModuleProgress

const HilightContainer = styled.div`
  display: flex;
  flex-direction: row;
  padding: 1rem 0;
`

const highlightItemStyle = css`
  align-items: center;
  display: flex;
  flex: 1;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: middle;
  padding: 0 0.5rem;
  text-align: center;
`

// eslint-disable-next-line i18next/no-literal-string
const highlightItemLeftBorder = css`
  border-left: 2px solid ${baseTheme.colors.grey[100]};
`

interface HighlightItemProps {
  highlightColor: string
  highlightDescription: string
  highlightText: string | number
  leftBorder: boolean
}

const HighlightItem: React.FC<HighlightItemProps> = ({
  highlightColor,
  highlightDescription,
  highlightText,
  leftBorder,
}) => {
  const wrapperClassName = leftBorder
    ? cx(highlightItemStyle, highlightItemLeftBorder)
    : highlightItemStyle
  return (
    <div className={wrapperClassName}>
      <div
        className={css`
          color: ${highlightColor};
          flex: 2;
          font-size: 2em;
          font-weight: bold;
          text-align: center;
        `}
      >
        {highlightText}
      </div>
      <div
        className={css`
          align-items: center;
          display: flex;
          flex: 1 0 auto;
          justify-content: middle;
          padding: 0 0.5rem;
          text-align: center;
        `}
      >
        {highlightDescription}
      </div>
    </div>
  )
}
