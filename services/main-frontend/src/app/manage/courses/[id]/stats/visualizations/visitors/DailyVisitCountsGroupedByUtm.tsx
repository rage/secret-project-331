"use client"

import { css } from "@emotion/css"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { PageVisitDatumSummaryByCourse } from "@/generated/api/types.generated"
import useCoursePageVisitDatumSummary from "@/hooks/useCoursePageVisitDatumSummary"
import Accordion from "@/shared-module/common/components/Accordion"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

import { InstructionBox } from "../../CourseStatsPage"
import StatsHeader from "../../StatsHeader"
import NoDataMessage from "../NoDataMessage"

export interface DailyVisitCountsGroupedByUtmProps {
  courseId: string
}

const DEFAULT_HEIGHT = 300

const containerStyles = css`
  margin-bottom: 2rem;
  min-height: ${DEFAULT_HEIGHT}px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
`

const tableStyles = css`
  width: 100%;

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  td {
    padding: 0.5rem 0.7rem;
    max-width: 250px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    border: 1px solid ${baseTheme.colors.clear[300]};
  }
  thead {
    th {
      text-align: left;
      padding-left: 0.5rem;
      font-weight: 600;
      font-size: 14px;
      line-height: 16px;
      color: ${baseTheme.colors.gray[500]};
    }
  }
`

const DailyVisitCountsGroupedByUtm: React.FC<
  React.PropsWithChildren<DailyVisitCountsGroupedByUtmProps>
> = ({ courseId }) => {
  const { t } = useTranslation()
  const query = useCoursePageVisitDatumSummary(courseId)

  const aggregatedData = useMemo(() => {
    if (!query.data) {
      return null
    }
    const aggregated = query.data.reduce(
      (acc, row) => {
        const key = rowToGroupingKey(row)
        if (!acc[key]) {
          acc[key] = {
            ...row,
            num_visitors: 0,
            // Excluded fields
            referrer: null,
          }
        }
        acc[key].num_visitors += row.num_visitors
        return acc
      },
      {} as Record<string, PageVisitDatumSummaryByCourse>,
    )

    const sorted = Object.values(aggregated).toSorted((a, b) => {
      if (a.visit_date < b.visit_date) {
        return -1
      }
      if (a.visit_date > b.visit_date) {
        return 1
      }
      return a.num_visitors - b.num_visitors
    })

    return sorted
  }, [query.data])

  const columnHelper = createColumnHelper<PageVisitDatumSummaryByCourse>()

  const columns = [
    columnHelper.accessor("visit_date", {
      header: t("header-visit-date"),
    }),
    columnHelper.accessor("utm_source", { header: "UTM Source" }),
    columnHelper.accessor("utm_medium", { header: "UTM Medium" }),
    columnHelper.accessor("utm_campaign", { header: "UTM Campaign" }),
    columnHelper.accessor("utm_term", { header: "UTM Term" }),
    columnHelper.accessor("utm_content", { header: "UTM Content" }),
    columnHelper.accessor("num_visitors", { header: t("header-number-of-visitors") }),
  ]

  const table = useReactTable({
    data: aggregatedData ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      <StatsHeader heading={t("stats-heading-utm-traffic-details")} debugData={aggregatedData} />
      <InstructionBox>{t("stats-instruction-utm-traffic-details")}</InstructionBox>
      <div className={containerStyles}>
        <QueryResult query={query} emptyFallback={<NoDataMessage />}>
          {() =>
            !aggregatedData || aggregatedData.length === 0 ? (
              <NoDataMessage />
            ) : (
              <Accordion
                className={css`
                  width: 100%;
                  margin-bottom: 0.5rem;
                `}
              >
                <details>
                  <summary>{t("header-grouped-by-utm-tags")}</summary>
                  <div className={tableStyles}>
                    <table>
                      <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                          <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                              <th key={header.id}>
                                {!header.isPlaceholder &&
                                  flexRender(header.column.columnDef.header, header.getContext())}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {table.getRowModel().rows.map((row) => (
                          <tr key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </Accordion>
            )
          }
        </QueryResult>
      </div>
    </>
  )
}

function rowToGroupingKey(row: PageVisitDatumSummaryByCourse) {
  return `${row.visit_date}-${row.utm_source}-${row.utm_medium}-${row.utm_campaign}-${row.utm_term}-${row.utm_content}`
}

export default withErrorBoundary(DailyVisitCountsGroupedByUtm)
