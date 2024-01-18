import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { groupBy, mapValues, sortBy } from "lodash"
import { Fragment, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { GlobalStatEntry } from "../../../shared-module/bindings"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import FullWidthTable, { FullWidthTableRow } from "../../tables/FullWidthTable"

interface GlobalStatTableProps {
  query: UseQueryResult<GlobalStatEntry[]>
}

const GlobalStatTable: React.FC<GlobalStatTableProps> = ({ query }) => {
  const { t } = useTranslation()
  const data = useMemo(() => {
    const data = sortBy(query.data || [], ["organization_name", "name"])
    const groupedByOrg = groupBy(data, (entry) => entry.organization_id)
    return mapValues(groupedByOrg, (entries) => groupBy(entries, (entry) => entry.course_id))
  }, [query.data])
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
                <td>{firstEntry.name}</td>
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
