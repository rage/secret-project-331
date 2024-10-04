import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import HighlightItem from "./HilightItem"

import { baseTheme } from "@/shared-module/common/styles"

const HighlightContainer = styled.div`
  display: flex;
  flex-direction: row;
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
      <HighlightContainer>
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
      </HighlightContainer>
    </>
  )
}

export default CompletionRequirementsTabulation
