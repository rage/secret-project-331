import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { useTotalUsersCompletedCourseQuery, useTotalUsersStartedCourseQuery } from "@/hooks/stats"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface TotalStatsProps {
  courseId: string
}

const TotalStats: React.FC<React.PropsWithChildren<TotalStatsProps>> = ({ courseId }) => {
  const { t } = useTranslation()
  const totalUsersQuery = useTotalUsersStartedCourseQuery(courseId)
  const totalCompletionsQuery = useTotalUsersCompletedCourseQuery(courseId)

  if (totalUsersQuery.error || totalCompletionsQuery.error) {
    return (
      <ErrorBanner
        variant="readOnly"
        error={totalUsersQuery.error || totalCompletionsQuery.error}
      />
    )
  }

  if (totalUsersQuery.isLoading || totalCompletionsQuery.isLoading) {
    return <Spinner variant="medium" />
  }

  return (
    <>
      <StatHeading>{t("stats-heading-total-users")}</StatHeading>
      <InstructionBox>{t("stats-instruction-total-users")}</InstructionBox>
      <div
        className={css`
          margin-bottom: 2rem;
          border: 3px solid ${baseTheme.colors.clear[200]};
          border-radius: 6px;
          padding: 1rem;
        `}
      >
        {/* TODO: Implement visualization with the data */}
        <div>Total users visualization will go here</div>
        <DebugModal data={totalUsersQuery.data} />
      </div>

      <StatHeading>{t("stats-heading-total-completions")}</StatHeading>
      <InstructionBox>{t("stats-instruction-total-completions")}</InstructionBox>
      <div
        className={css`
          margin-bottom: 2rem;
          border: 3px solid ${baseTheme.colors.clear[200]};
          border-radius: 6px;
          padding: 1rem;
        `}
      >
        {/* TODO: Implement visualization with the data */}
        <div>Total completions visualization will go here</div>
        <DebugModal data={totalCompletionsQuery.data} />
      </div>
    </>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(TotalStats))
