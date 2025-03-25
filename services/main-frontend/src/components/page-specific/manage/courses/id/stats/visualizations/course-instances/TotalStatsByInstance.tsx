import { css } from "@emotion/css"
import { TFunction } from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  useTotalUsersCompletedCourseByInstanceQuery,
  useTotalUsersReturnedExercisesByInstanceQuery,
  useTotalUsersStartedCourseByInstanceQuery,
} from "@/hooks/stats"
import useCourseInstancesQuery from "@/hooks/useCourseInstancesQuery"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { baseTheme } from "@/shared-module/common/styles"
import { formatNumber } from "@/shared-module/common/utils/numbers"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface TotalStatsByInstanceProps {
  courseId: string
}

const tableStyles = css`
  width: 100%;
  border-collapse: collapse;
  margin: 2rem 0;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  overflow: hidden;
`

const thStyles = css`
  background: ${baseTheme.colors.clear[200]};
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
  font-size: 0.9rem;
  letter-spacing: 0.5px;
`

const tdStyles = css`
  padding: 1rem;
  border-bottom: 1px solid ${baseTheme.colors.clear[200]};
  color: ${baseTheme.colors.gray[700]};
  font-size: 1rem;
`

const numberCellStyles = css`
  ${tdStyles}
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: ${baseTheme.colors.green[600]};
  font-weight: 600;
`

const loadingRowStyles = css`
  @keyframes pulse {
    0%,
    100% {
      background-color: ${baseTheme.colors.gray[200]};
    }
    50% {
      background-color: ${baseTheme.colors.gray[300]};
    }
  }

  td {
    padding: 1rem;
    height: 53px;
  }

  .loading-placeholder {
    height: 20px;
    border-radius: 4px;
    animation: pulse 1.5s ease-in-out infinite;
    animation-delay: 500ms;
  }
`

const getInstanceDisplayName = (
  instance: { name: string | null } | undefined,
  instanceId: string,
  t: TFunction,
) => {
  if (!instance) {
    return instanceId
  }
  if (!instance.name) {
    return t("default-instance")
  }
  return instance.name
}

const TotalStatsByInstance: React.FC<React.PropsWithChildren<TotalStatsByInstanceProps>> = ({
  courseId,
}) => {
  const { t, i18n } = useTranslation()
  const totalUsersQuery = useTotalUsersStartedCourseByInstanceQuery(courseId)
  const totalCompletionsQuery = useTotalUsersCompletedCourseByInstanceQuery(courseId)
  const totalReturnedExercisesQuery = useTotalUsersReturnedExercisesByInstanceQuery(courseId)
  const courseInstancesQuery = useCourseInstancesQuery(courseId)

  const hasError =
    totalUsersQuery.error ||
    totalCompletionsQuery.error ||
    totalReturnedExercisesQuery.error ||
    courseInstancesQuery.error
  const isLoading =
    totalUsersQuery.isLoading ||
    totalCompletionsQuery.isLoading ||
    totalReturnedExercisesQuery.isLoading ||
    courseInstancesQuery.isLoading

  const instanceMap = useMemo(() => {
    if (!courseInstancesQuery.data) {
      return new Map()
    }
    return new Map(courseInstancesQuery.data.map((instance) => [instance.id, instance]))
  }, [courseInstancesQuery.data])

  const allInstanceIds = useMemo(() => {
    if (isLoading || hasError) {
      return []
    }
    const instanceIds = new Set<string>()
    if (totalUsersQuery.data) {
      Object.keys(totalUsersQuery.data).forEach((id) => instanceIds.add(id))
    }
    if (totalCompletionsQuery.data) {
      Object.keys(totalCompletionsQuery.data).forEach((id) => instanceIds.add(id))
    }
    if (totalReturnedExercisesQuery.data) {
      Object.keys(totalReturnedExercisesQuery.data).forEach((id) => instanceIds.add(id))
    }
    // Sort by instance name, with default instance first
    return Array.from(instanceIds).sort((a, b) => {
      const instanceA = instanceMap.get(a)
      const instanceB = instanceMap.get(b)

      // If either instance has no name, it's the default instance
      const isDefaultA = !instanceA?.name
      const isDefaultB = !instanceB?.name

      // Default instance should come first
      if (isDefaultA && !isDefaultB) {
        return -1
      }
      if (!isDefaultA && isDefaultB) {
        return 1
      }

      // If both are default or both are named, sort by name/default text
      const nameA = getInstanceDisplayName(instanceA, a, t)
      const nameB = getInstanceDisplayName(instanceB, b, t)
      return nameA.localeCompare(nameB)
    })
  }, [
    totalUsersQuery.data,
    totalCompletionsQuery.data,
    totalReturnedExercisesQuery.data,
    isLoading,
    hasError,
    instanceMap,
    t,
  ])

  return (
    <div>
      {hasError ? (
        <ErrorBanner
          variant="readOnly"
          error={
            totalUsersQuery.error ||
            totalCompletionsQuery.error ||
            totalReturnedExercisesQuery.error ||
            courseInstancesQuery.error
          }
        />
      ) : (
        <table className={tableStyles}>
          <thead>
            <tr>
              <th className={thStyles}>{t("stats-heading-course-instance")}</th>
              <th className={thStyles}>{t("stats-heading-students-started-the-course")}</th>
              <th className={thStyles}>{t("stats-heading-students-returned-exercises")}</th>
              <th className={thStyles}>{t("stats-heading-students-completed-the-course")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? // Loading state - show 3 loading rows
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className={loadingRowStyles}>
                    <td>
                      <div className="loading-placeholder" />
                    </td>
                    <td>
                      <div className="loading-placeholder" />
                    </td>
                    <td>
                      <div className="loading-placeholder" />
                    </td>
                    <td>
                      <div className="loading-placeholder" />
                    </td>
                  </tr>
                ))
              : allInstanceIds.map((instanceId) => (
                  <tr key={instanceId}>
                    <td className={tdStyles}>
                      {getInstanceDisplayName(instanceMap.get(instanceId), instanceId, t)}
                    </td>
                    <td className={numberCellStyles}>
                      {formatNumber(totalUsersQuery.data?.[instanceId]?.count || 0, i18n.language)}
                    </td>
                    <td className={numberCellStyles}>
                      {formatNumber(
                        totalReturnedExercisesQuery.data?.[instanceId]?.count || 0,
                        i18n.language,
                      )}
                    </td>
                    <td className={numberCellStyles}>
                      {formatNumber(
                        totalCompletionsQuery.data?.[instanceId]?.count || 0,
                        i18n.language,
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default withErrorBoundary(TotalStatsByInstance)
