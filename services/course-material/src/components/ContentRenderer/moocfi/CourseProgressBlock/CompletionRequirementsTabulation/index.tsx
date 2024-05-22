import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import HighlightItem from "./HilightItem"

import { baseTheme } from "@/shared-module/common/styles"

const HilightContainer = styled.div`
  display: flex;
  flex-direction: row;
  padding: 1rem 0;
`

export interface CompletionRequirementsTabulationProps {
  attemptedExercisesRequiredForCompletion: number | null
  pointsRequiredForCompletion: number | null
}

const CompletionRequirementsTabulation: React.FC<
  React.PropsWithChildren<CompletionRequirementsTabulationProps>
> = ({ attemptedExercisesRequiredForCompletion, pointsRequiredForCompletion }) => {
  const { t } = useTranslation()
  return (
    <>
      <HilightContainer>
        {!!pointsRequiredForCompletion && (
          <HighlightItem
            highlightColor={baseTheme.colors.gradient["green"]}
            highlightDescription={t("points-required-for-completion")}
            highlightText={pointsRequiredForCompletion}
          />
        )}
        {attemptedExercisesRequiredForCompletion && (
          <HighlightItem
            highlightColor={baseTheme.colors.gradient["blue"]}
            highlightDescription={t("attempted-exercises-required-for-completion")}
            highlightText={attemptedExercisesRequiredForCompletion}
            leftBorder={!!pointsRequiredForCompletion}
          />
        )}
      </HilightContainer>
    </>
  )
}

export default CompletionRequirementsTabulation
