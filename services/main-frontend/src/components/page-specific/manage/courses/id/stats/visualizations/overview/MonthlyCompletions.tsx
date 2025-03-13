import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox, StatHeading } from "../../CourseStatsPage"

import { useMonthlyCourseCompletionsQuery } from "@/hooks/stats"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface MonthlyCompletionsProps {
  courseId: string
}

const MonthlyCompletions: React.FC<React.PropsWithChildren<MonthlyCompletionsProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()

  // export interface CountResult {
  //   period: string | null
  //   count: number
  // }
  // The data is an array of these
  const { data: realData, isLoading, error } = useMonthlyCourseCompletionsQuery(courseId)

  // Add placeholder data for preview/development
  const placeholderData = [
    { period: "2024-01", count: 15 },
    { period: "2024-02", count: 23 },
    { period: "2024-03", count: 18 },
    { period: "2024-04", count: 30 },
    { period: "2024-05", count: 25 },
    { period: "2024-06", count: 35 },
  ]

  // Use real data if available, otherwise use placeholder
  const data = realData?.length ? realData : placeholderData

  if (error) {
    return <ErrorBanner variant="readOnly" error={error} />
  }

  if (isLoading) {
    return <Spinner variant="medium" />
  }

  if (!data || data.length === 0) {
    return <div>{t("no-data")}</div>
  }

  return (
    <>
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 0.5rem;
        `}
      >
        <StatHeading>{t("stats-heading-monthly-completions")}</StatHeading>
        <DebugModal
          variant="minimal"
          data={data}
          buttonWrapperStyles={css`
            display: flex;
            align-items: center;
          `}
        />
      </div>
      <InstructionBox>{t("stats-instruction-monthly-completions")}</InstructionBox>
      <div
        className={css`
          margin-bottom: 2rem;
          border: 3px solid ${baseTheme.colors.clear[200]};
          border-radius: 6px;
          padding: 1rem;
        `}
      >
        {/* TODO: Implement visualization with the data */}
        <div>
          {data.map((item) => (
            <div key={item.period}>
              {item.period}: {item.count} completions
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(MonthlyCompletions))
