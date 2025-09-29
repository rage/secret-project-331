import { css } from "@emotion/css"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import useCoursePageVisitDatumSummary from "@/hooks/useCoursePageVisitDatumSummary"
import { PageVisitDatumSummaryByCourse } from "@/shared-module/common/bindings"
import Accordion from "@/shared-module/common/components/Accordion"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface DailyVisitCountsGroupedByReferrerProps {
  courseId: string
}

const DailyVisitCountsGroupedByReferrer: React.FC<
  React.PropsWithChildren<DailyVisitCountsGroupedByReferrerProps>
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
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            utm_term: null,
            utm_content: null,
          }
        }
        acc[key].num_visitors += row.num_visitors
        return acc
      },
      {} as Record<string, PageVisitDatumSummaryByCourse>,
    )

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
    }),
    columnHelper.accessor("referrer", { header: t("header-referrer") }),
    columnHelper.accessor("num_visitors", { header: t("header-number-of-visitors") }),
  ]

  const table = useReactTable({
    data: aggregatedData ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div
      className={css`
        margin-bottom: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
      `}
    >
      {query.isLoading ? (
        <Spinner variant="medium" />
      ) : query.isError ? (
        <ErrorBanner variant="readOnly" error={query.error} />
      ) : !aggregatedData || aggregatedData.length === 0 ? null : (
        <>
          <Accordion
            className={css`
              margin-bottom: 0.5rem;
              width: 100%;
            `}
          >
            <details>
              <summary>{t("header-grouped-by-referrer")}</summary>
              <div
                className={css`
                  table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                  }

                  td {
                    padding: 0.5rem 0.7rem;
                    max-width: 3000px;
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
        </>
      )}
    </div>
  )
}

function rowToGroupingKey(row: PageVisitDatumSummaryByCourse) {
  return `${row.visit_date}-${row.referrer}`
}

export default withErrorBoundary(
  dontRenderUntilQueryParametersReady(DailyVisitCountsGroupedByReferrer),
)
