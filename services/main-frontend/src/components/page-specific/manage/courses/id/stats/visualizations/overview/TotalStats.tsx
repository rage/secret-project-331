"use client"
import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  useTotalUsersCompletedCourseQuery,
  useTotalUsersCompletedCourseQueryCustomTimePeriod,
  useTotalUsersReturnedExercisesQuery,
  useTotalUsersReturnedExercisesQueryCustomTimePeriod,
  useTotalUsersStartedCourseQuery,
  useTotalUsersStartedCourseQueryCustomTimePeriod,
} from "@/hooks/stats"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import DatePickerField from "@/shared-module/common/components/InputFields/DatePickerField"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
import { baseTheme } from "@/shared-module/common/styles"
import { formatNumber } from "@/shared-module/common/utils/numbers"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface TotalStatsProps {
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

const loadingValueStyles = css`
  @keyframes pulse {
    0%,
    100% {
      background-color: ${baseTheme.colors.gray[200]};
    }
    50% {
      background-color: ${baseTheme.colors.gray[300]};
    }
  }

  height: 67.2px;
  width: 120px;
  margin: 0 auto 0.5rem;
  border-radius: 4px;
  background-color: white;
  animation: pulse 1.5s ease-in-out infinite;
  animation-delay: 500ms;
`

const statTitleStyles = css`
  margin: 0;
  color: ${baseTheme.colors.gray[700]};
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`
export const CUSTOM_RANGE = "custom" as const
export const TOTAL_RANGE = "total" as const

const TotalStats: React.FC<React.PropsWithChildren<TotalStatsProps>> = ({ courseId }) => {
  const { t, i18n } = useTranslation()
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [rangeMode, setRangeMode] = useState<"total" | "custom">(TOTAL_RANGE)

  const totalUsersNormal = useTotalUsersStartedCourseQuery(courseId, {
    enabled: rangeMode === TOTAL_RANGE,
  })
  const totalReturnedNormal = useTotalUsersReturnedExercisesQuery(courseId, {
    enabled: rangeMode === TOTAL_RANGE,
  })
  const totalCompletionsNormal = useTotalUsersCompletedCourseQuery(courseId, {
    enabled: rangeMode === TOTAL_RANGE,
  })

  const customEnabled = rangeMode === CUSTOM_RANGE && startDate && endDate && startDate <= endDate
  const totalUsersCustom = useTotalUsersStartedCourseQueryCustomTimePeriod(
    courseId,
    startDate ?? "",
    endDate ?? "",
    {
      enabled: !!customEnabled,
    },
  )
  const totalReturnedCustom = useTotalUsersReturnedExercisesQueryCustomTimePeriod(
    courseId,
    startDate ?? "",
    endDate ?? "",
    {
      enabled: !!customEnabled,
    },
  )
  const totalCompletionsCustom = useTotalUsersCompletedCourseQueryCustomTimePeriod(
    courseId,
    startDate ?? "",
    endDate ?? "",
    {
      enabled: !!customEnabled,
    },
  )

  const usersQuery = customEnabled ? totalUsersCustom : totalUsersNormal
  const returnedQuery = customEnabled ? totalReturnedCustom : totalReturnedNormal
  const completionsQuery = customEnabled ? totalCompletionsCustom : totalCompletionsNormal

  const isLoading = usersQuery.isLoading || returnedQuery.isLoading || completionsQuery.isLoading

  const hasError = usersQuery.error || returnedQuery.error || completionsQuery.error

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
      {hasError ? (
        <ErrorBanner
          variant="readOnly"
          error={usersQuery.error || returnedQuery.error || completionsQuery.error}
        />
      ) : (
        <div>
          <div
            className={css`
              display: flex;
              gap: 1rem;
              align-items: center;
              justify-content: flex-end;
            `}
          >
            {rangeMode === CUSTOM_RANGE && (
              <div
                className={css`
                  display: flex;
                  gap: 4px;
                  padding-bottom: 15px;
                `}
              >
                <DatePickerField
                  label={t("stats-start-date")}
                  value={startDate ?? ""}
                  onChangeByValue={(value) => setStartDate(value)}
                />
                <DatePickerField
                  label={t("stats-end-date")}
                  value={endDate ?? ""}
                  onChangeByValue={(value) => setEndDate(value)}
                />
              </div>
            )}

            <SelectMenu
              id="period-select"
              options={[
                { value: TOTAL_RANGE, label: t("stats-period-total") },
                { value: CUSTOM_RANGE, label: t("stats-period-custom") },
              ]}
              value={rangeMode}
              onChange={(e) => setRangeMode(e.currentTarget.value as "total" | "custom")}
              className={css`
                margin-bottom: 0;
                min-width: 120px;
              `}
              showDefaultOption={false}
            />
          </div>

          <div
            className={css`
              display: flex;
              gap: 2rem;
              justify-content: center;
              flex-wrap: wrap;
            `}
          >
            <div className={statBoxStyles}>
              {isLoading ? (
                <div className={loadingValueStyles} />
              ) : (
                <div className={statValueStyles}>
                  {formatNumber(usersQuery.data?.count || 0, i18n.language)}
                </div>
              )}
              <h3 className={statTitleStyles}>{t("stats-heading-students-started-the-course")}</h3>
            </div>

            <div className={statBoxStyles}>
              {isLoading ? (
                <div className={loadingValueStyles} />
              ) : (
                <div className={statValueStyles}>
                  {formatNumber(returnedQuery.data?.count || 0, i18n.language)}
                </div>
              )}
              <h3 className={statTitleStyles}>{t("stats-heading-students-returned-exercises")}</h3>
            </div>

            <div className={statBoxStyles}>
              {isLoading ? (
                <div className={loadingValueStyles} />
              ) : (
                <div className={statValueStyles}>
                  {formatNumber(completionsQuery.data?.count || 0, i18n.language)}
                </div>
              )}
              <h3 className={statTitleStyles}>
                {t("stats-heading-students-completed-the-course")}
              </h3>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withErrorBoundary(TotalStats)
