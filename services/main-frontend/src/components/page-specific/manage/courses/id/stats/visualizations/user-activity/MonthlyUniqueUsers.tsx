import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { useMonthlyUniqueUsersStartingQuery } from "@/hooks/stats"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface MonthlyUniqueUsersProps {
  courseId: string
}

const MonthlyUniqueUsers: React.FC<React.PropsWithChildren<MonthlyUniqueUsersProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const { data, isLoading, error } = useMonthlyUniqueUsersStartingQuery(courseId)

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
    <div
      className={css`
        margin-bottom: 2rem;
        border: 3px solid ${baseTheme.colors.clear[200]};
        border-radius: 6px;
        padding: 1rem;
      `}
    >
      {/* TODO: Implement visualization with the data */}
      {/* data format will be an array of objects with { date: string, count: number } */}
      <div>Visualization will go here</div>
      <DebugModal data={data} />
    </div>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(MonthlyUniqueUsers))
