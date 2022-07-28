import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../../../../shared-module/styles"

import HighlightItem from "./HilightItem"

const HilightContainer = styled.div`
  display: flex;
  flex-direction: row;
  padding: 1rem 0;
`

export interface ExerciseCountDisplayProps {
  exercisesAnswered: number
  exercisesNeededToAnswer: number
  totalExercises: number
}

const ExerciseCountDisplay: React.FC<React.PropsWithChildren<ExerciseCountDisplayProps>> = ({
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

export default ExerciseCountDisplay
