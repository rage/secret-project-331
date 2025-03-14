import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { groupBy, mapValues, sortBy } from "lodash"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import FullWidthTable, { FullWidthTableRow } from "../../tables/FullWidthTable"

import {
  GlobalCourseModuleStatEntry,
  GlobalStatEntry,
  TimeGranularity,
} from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

type RegularStatTableProps = {
  query: UseQueryResult<GlobalStatEntry[]>
  moduleStats: false
  granularity: TimeGranularity
}

type ModuleStatTableProps = {
  query: UseQueryResult<GlobalCourseModuleStatEntry[]>
  moduleStats: true
  granularity: TimeGranularity
}

type GlobalStatTableProps = RegularStatTableProps | ModuleStatTableProps

const GlobalStatTable: React.FC<GlobalStatTableProps> = ({ query, moduleStats, granularity }) => {
  const { t } = useTranslation()

  const transformedData: GlobalStatEntry[] = useMemo(() => {
    if (!query.data) {
      return []
    }
    if (!moduleStats) {
      return query.data
    }
    const res = query.data
      ?.filter(
        (entry) =>
          entry.course_module_ects_credits !== null && entry.course_module_ects_credits !== 0,
      )
      .map(
        (entry) =>
          ({
            ...entry,
            course_name: `${entry.course_name} (${
              entry.course_module_name ?? t("default-module")
            })`,
            value: entry.value * (entry.course_module_ects_credits ?? 0),
            month: null,
            year: Number(entry.year),
          }) satisfies GlobalStatEntry,
      )
    return res
  }, [moduleStats, query.data, t])

  const data = useMemo(() => {
    const data = sortBy(transformedData || [], ["organization_name", "name"])
    const groupedByOrg = groupBy(data, (entry) => entry.organization_id)
    return mapValues(groupedByOrg, (entries) => groupBy(entries, (entry) => entry.course_id))
  }, [transformedData])

  const timeColumns = useMemo(() => {
    if (granularity === "Year") {
      const years = Array.from(new Set(query.data?.map((entry) => Number(entry.year))))
      years.sort((a, b) => a - b)
      return years.map((year) => ({
        key: String(year),
        label: String(year),
        isYear: true,
      }))
    } else if (granularity === "Month") {
      const columns: { key: string; label: string; isYear: boolean }[] = []
      const entries = query.data || []

      if (entries.length === 0) {
        return []
      }

      // First find the min and max dates
      let minYear = Infinity
      let maxYear = -Infinity
      let minMonth = 12
      let maxMonth = 1

      entries.forEach((entry) => {
        if (!entry.year) {
          return
        }
        const year = Number(entry.year)
        const month = moduleStats ? 1 : Number((entry as GlobalStatEntry).month)

        if (year < minYear || (year === minYear && month < minMonth)) {
          minYear = year
          minMonth = month
        }
        if (year > maxYear || (year === maxYear && month > maxMonth)) {
          maxYear = year
          maxMonth = month
        }
      })

      // Check if we found any valid dates
      if (minYear === Infinity || maxYear === -Infinity) {
        return []
      }

      // Generate all months between min and max
      for (let year = minYear; year <= maxYear; year++) {
        const startMonth = year === minYear ? minMonth : 1
        const endMonth = year === maxYear ? maxMonth : 12

        for (let month = startMonth; month <= endMonth; month++) {
          const monthStr = String(month).padStart(2, "0")
          const yearMonth = `${year}-${monthStr}`
          columns.push({
            key: yearMonth,
            label: moduleStats ? String(year) : yearMonth,
            isYear: moduleStats,
          })
        }
      }

      return columns
    }

    return []
  }, [query.data, granularity, moduleStats])

  if (query.isError) {
    return <ErrorBanner variant="text" error={query.error} />
  }

  if (query.isLoading) {
    return (
      <div>
        <Spinner variant="medium" />
      </div>
    )
  }

  return (
    <FullWidthTable>
      <thead>
        <FullWidthTableRow>
          <th>{t("organization")}</th>
          <th>{t("course")}</th>
          {timeColumns.map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
        </FullWidthTableRow>
      </thead>
      <tbody>
        {Object.entries(data).map(([_organizationId, organizationCourses]) => {
          const organizationCoursesCount = Object.entries(organizationCourses).length
          return Object.entries(organizationCourses).map(([courseId, entries], n) => {
            const firstEntry = entries[0]
            entries.sort((a, b) => {
              if (a.year !== b.year) {
                return Number(a.year) - Number(b.year)
              }
              if (a.month && b.month) {
                return Number(a.month) - Number(b.month)
              }
              return 0
            })
            return (
              <FullWidthTableRow key={courseId}>
                {n === 0 && (
                  <td
                    className={css`
                      vertical-align: top;
                    `}
                    rowSpan={organizationCoursesCount}
                  >
                    {firstEntry.organization_name}
                  </td>
                )}
                <td>{firstEntry.course_name}</td>
                {timeColumns.map((column) => {
                  let entry
                  if (column.isYear) {
                    entry = entries.find((entry) => entry.year === Number(column.key))
                  } else {
                    const [year, month] = column.key.split("-")
                    entry = entries.find(
                      (entry) =>
                        entry.year === Number(year) &&
                        (moduleStats ||
                          String((entry as GlobalStatEntry).month).padStart(2, "0") === month),
                    )
                  }
                  return <td key={column.key}>{entry ? entry.value : "-"}</td>
                })}
              </FullWidthTableRow>
            )
          })
        })}
      </tbody>
    </FullWidthTable>
  )
}

export default withErrorBoundary(GlobalStatTable)
