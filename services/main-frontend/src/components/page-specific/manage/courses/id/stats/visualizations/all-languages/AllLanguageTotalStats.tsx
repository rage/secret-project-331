import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  useTotalUsersCompletedCourseQuery,
  useTotalUsersReturnedExercisesQuery,
  useTotalUsersStartedAllLanguageVersionsQuery,
} from "@/hooks/stats"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import { formatNumber } from "@/shared-module/common/utils/numbers"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface AllLanguageTotalStatsProps {
  courseId: string
}

const statBoxStyles = css`
  flex: 1;
  max-width: 300px;
  border: 3px solid ${baseTheme.colors.clear[200]};
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`

const statValueStyles = css`
  font-size: 2.8rem;
  font-weight: bold;
  color: ${baseTheme.colors.green[600]};
  margin-bottom: 0.5rem;
`

const statTitleStyles = css`
  margin: 0;
  color: ${baseTheme.colors.gray[700]};
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const AllLanguageTotalStats: React.FC<React.PropsWithChildren<AllLanguageTotalStatsProps>> = ({
  courseId,
}) => {
  const { t, i18n } = useTranslation()
  const totalUsersQuery = useTotalUsersStartedAllLanguageVersionsQuery(courseId)
  const totalCompletionsQuery = useTotalUsersCompletedCourseQuery(courseId)
  const totalReturnedExercisesQuery = useTotalUsersReturnedExercisesQuery(courseId)

  if (totalUsersQuery.error || totalCompletionsQuery.error || totalReturnedExercisesQuery.error) {
    return (
      <ErrorBanner
        variant="readOnly"
        error={
          totalUsersQuery.error || totalCompletionsQuery.error || totalReturnedExercisesQuery.error
        }
      />
    )
  }

  if (
    totalUsersQuery.isLoading ||
    totalCompletionsQuery.isLoading ||
    totalReturnedExercisesQuery.isLoading
  ) {
    return <Spinner variant="medium" />
  }

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 3rem;
        margin-bottom: 2rem;
      `}
    >
      <div
        className={css`
          display: flex;
          gap: 2rem;
          justify-content: center;
          flex-wrap: wrap;
        `}
      >
        <div className={statBoxStyles}>
          <div className={statValueStyles}>
            {formatNumber(totalUsersQuery.data?.count || 0, i18n.language)}
          </div>
          <h3 className={statTitleStyles}>{t("stats-heading-students-started-the-course")}</h3>
        </div>

        <div className={statBoxStyles}>
          <div className={statValueStyles}>
            {formatNumber(totalReturnedExercisesQuery.data?.count || 0, i18n.language)}
          </div>
          <h3 className={statTitleStyles}>{t("stats-heading-students-returned-exercises")}</h3>
        </div>

        <div className={statBoxStyles}>
          <div className={statValueStyles}>
            {formatNumber(totalCompletionsQuery.data?.count || 0, i18n.language)}
          </div>
          <h3 className={statTitleStyles}>{t("stats-heading-students-completed-the-course")}</h3>
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(AllLanguageTotalStats))
