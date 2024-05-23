import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { groupBy, mapValues, sortBy } from "lodash"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import FullWidthTable, { FullWidthTableRow } from "../../tables/FullWidthTable"

import { GlobalCourseModuleStatEntry, GlobalStatEntry } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

type RegularStatTableProps = {
  query: UseQueryResult<GlobalStatEntry[]>
  moduleStats: false
}

type ModuleStatTableProps = {
  query: UseQueryResult<GlobalCourseModuleStatEntry[]>
  moduleStats: true
}

type GlobalStatTableProps = RegularStatTableProps | ModuleStatTableProps

const GlobalStatTable: React.FC<GlobalStatTableProps> = ({ query, moduleStats }) => {
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
          }) satisfies GlobalStatEntry,
      )
    return res
  }, [moduleStats, query.data, t])
  const data = useMemo(() => {
    const data = sortBy(transformedData || [], ["organization_name", "name"])
    const groupedByOrg = groupBy(data, (entry) => entry.organization_id)
    return mapValues(groupedByOrg, (entries) => groupBy(entries, (entry) => entry.course_id))
  }, [transformedData])
  const allYears = useMemo(() => {
    const years = Array.from(new Set(query.data?.map((entry) => Number(entry.year))))
    years.sort((a, b) => a - b)
    return years
  }, [query.data])

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
          {allYears.map((year) => (
            <th key="year">{year}</th>
          ))}
        </FullWidthTableRow>
      </thead>
      <tbody>
        {Object.entries(data).map(([_organizationId, organizationCourses]) => {
          const organizationCoursesCount = Object.entries(organizationCourses).length
          return Object.entries(organizationCourses).map(([courseId, entries], n) => {
            const firstEntry = entries[0]
            entries.sort((a, b) => Number(a.year) - Number(b.year))
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
                {allYears.map((year) => {
                  const entry = entries.find((entry) => entry.year === String(year))
                  return <td key={year}>{entry ? entry.value : "-"}</td>
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
