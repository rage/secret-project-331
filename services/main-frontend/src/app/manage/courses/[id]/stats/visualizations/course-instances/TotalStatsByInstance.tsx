"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  useTotalUsersCompletedCourseByInstanceQuery,
  useTotalUsersReturnedExercisesByInstanceQuery,
  useTotalUsersStartedCourseByInstanceQuery,
} from "@/hooks/stats"
import useCourseInstancesQuery from "@/hooks/useCourseInstancesQuery"
import { baseTheme } from "@/shared-module/common/styles"
import { formatNumber } from "@/shared-module/common/utils/numbers"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResults } from "@/shared-module/components"

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

  const instanceMap = useMemo(() => {
    if (!courseInstancesQuery.data) {
      return new Map()
    }
    return new Map(courseInstancesQuery.data.map((instance) => [instance.id, instance]))
  }, [courseInstancesQuery.data])

  const allInstanceIds = useMemo(() => {
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
    return Array.from(instanceIds).toSorted((a, b) => {
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
    instanceMap,
    t,
  ])

  return (
    <div>
      <QueryResults
        queries={
          [
            totalUsersQuery,
            totalReturnedExercisesQuery,
            totalCompletionsQuery,
            courseInstancesQuery,
          ] as const
        }
        emptyFallback={
          <table className={tableStyles}>
            <thead>
              <tr>
                <th className={thStyles}>{t("stats-heading-course-instance")}</th>
                <th className={thStyles}>{t("stats-heading-students-started-the-course")}</th>
                <th className={thStyles}>{t("stats-heading-students-returned-exercises")}</th>
                <th className={thStyles}>{t("stats-heading-students-completed-the-course")}</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        }
        renderData={([totalUsers, totalReturnedExercises, totalCompletions]) => (
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
              {allInstanceIds.map((instanceId) => (
                <tr key={instanceId}>
                  <td className={tdStyles}>
                    {getInstanceDisplayName(instanceMap.get(instanceId), instanceId, t)}
                  </td>
                  <td className={numberCellStyles}>
                    {formatNumber(totalUsers?.[instanceId]?.count || 0, i18n.language)}
                  </td>
                  <td className={numberCellStyles}>
                    {formatNumber(totalReturnedExercises?.[instanceId]?.count || 0, i18n.language)}
                  </td>
                  <td className={numberCellStyles}>
                    {formatNumber(totalCompletions?.[instanceId]?.count || 0, i18n.language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      />
    </div>
  )
}

export default withErrorBoundary(TotalStatsByInstance)
