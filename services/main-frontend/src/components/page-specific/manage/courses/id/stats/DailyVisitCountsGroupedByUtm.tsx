import { css } from "@emotion/css"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import useCoursePageVisitDatumSummary from "../../../../../../hooks/useCoursePageVisitDatumSummary"
import { PageVisitDatumSummaryByCourse } from "../../../../../../shared-module/bindings"
import Accordion from "../../../../../../shared-module/components/Accordion"
import DebugModal from "../../../../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { dontRenderUntilQueryParametersReady } from "../../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../../../shared-module/utils/withErrorBoundary"

export interface DailyVisitCountsGroupedByUtmProps {
  courseId: string
}

const DailyVisitCountsGroupedByUtm: React.FC<
  React.PropsWithChildren<DailyVisitCountsGroupedByUtmProps>
> = ({ courseId }) => {
  const { t } = useTranslation()
  const query = useCoursePageVisitDatumSummary(courseId)

  const aggregatedData = useMemo(() => {
    if (!query.data) {
      return null
    }
    const aggregated = query.data.reduce((acc, row) => {
      const key = rowToGroupingKey(row)
      if (!acc[key]) {
        acc[key] = {
          ...row,
          num_visitors: 0,
          // Excluded fields
          referrer: null,
          device_type: null,
          country: null,
        }
      }
      acc[key].num_visitors += row.num_visitors
      return acc
    }, {} as Record<string, PageVisitDatumSummaryByCourse>)

    const sorted = Object.values(aggregated).sort((a, b) => {
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
      cell: (props) => props.row.original.visit_date.toISOString().split("T")[0],
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

  if (query.isError) {
    return <ErrorBanner variant="readOnly" error={query.error} />
  }

  if (query.isLoading || !query.data) {
    return <Spinner variant="medium" />
  }

  return (
    <div
      className={css`
        margin-bottom: 2rem;
      `}
    >
      <Accordion
        variant="detail"
        className={css`
          margin-bottom: 0.5rem;
        `}
      >
        <details>
          <summary>{t("header-grouped-by-utm-tags")}</summary>
          <div
            className={css`
              table {
                width: 100%;
              }
              th {
                text-align: left;
              }
              td {
                padding: 0.5rem 2rem;
                padding-left: 0;
              }
            `}
          >
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
      <DebugModal data={aggregatedData} />
    </div>
  )
}

function rowToGroupingKey(row: PageVisitDatumSummaryByCourse) {
  return `${row.visit_date}-${row.utm_source}-${row.utm_medium}-${row.utm_campaign}-${row.utm_term}-${row.utm_content}`
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(DailyVisitCountsGroupedByUtm))
