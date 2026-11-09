"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { ALIGN_END } from "@/components/credit-registration/constants"
import type { CountResult } from "@/generated/api/types.generated"
import {
  useTotalUsersCompletedCourseByInstanceQuery,
  useTotalUsersReturnedExercisesByInstanceQuery,
  useTotalUsersStartedCourseByInstanceQuery,
} from "@/hooks/stats"
import useCourseInstancesQuery from "@/hooks/useCourseInstancesQuery"
import { baseTheme } from "@/shared-module/common/styles"
import { formatNumber } from "@/shared-module/common/utils/numbers"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResults, Table, type TableColumn } from "@/shared-module/components"

interface TotalStatsByInstanceProps {
  courseId: string
}

const tableStyles = css`
  margin: 2rem 0;
`

const numberCellStyles = css`
  color: ${baseTheme.colors.green[600]};
  font-weight: 600;
`

type CountsByInstance = Record<string, CountResult | undefined> | undefined

interface CountsByColumn {
  totalUsers?: CountsByInstance
  totalReturnedExercises?: CountsByInstance
  totalCompletions?: CountsByInstance
}

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

  const countColumn = (header: string, counts: CountsByInstance): TableColumn<string> => ({
    header,
    align: ALIGN_END,
    cell: (instanceId) => (
      <span className={numberCellStyles}>
        {formatNumber(counts?.[instanceId]?.count || 0, i18n.language)}
      </span>
    ),
  })

  const columnsFor = ({
    totalUsers,
    totalReturnedExercises,
    totalCompletions,
  }: CountsByColumn): TableColumn<string>[] => {
    return [
      {
        header: t("stats-heading-course-instance"),
        cell: (instanceId) => getInstanceDisplayName(instanceMap.get(instanceId), instanceId, t),
      },
      countColumn(t("stats-heading-students-started-the-course"), totalUsers),
      countColumn(t("stats-heading-students-returned-exercises"), totalReturnedExercises),
      countColumn(t("stats-heading-students-completed-the-course"), totalCompletions),
    ]
  }

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
          <Table
            caption={t("stats-heading-course-instance")}
            className={tableStyles}
            columns={columnsFor({})}
            rows={[]}
            rowKey={(instanceId) => instanceId}
            emptyState={null}
          />
        }
        renderData={([totalUsers, totalReturnedExercises, totalCompletions]) => (
          <Table
            caption={t("stats-heading-course-instance")}
            className={tableStyles}
            columns={columnsFor({ totalUsers, totalReturnedExercises, totalCompletions })}
            rows={allInstanceIds}
            rowKey={(instanceId) => instanceId}
          />
        )}
      />
    </div>
  )
}

export default withErrorBoundary(TotalStatsByInstance)
