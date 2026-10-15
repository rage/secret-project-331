"use client"

import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { DENSITY_COMPACT } from "@/components/credit-registration/constants"
import type { PageVisitDatumSummaryByCourse } from "@/generated/api/types.generated"
import useCoursePageVisitDatumSummary from "@/hooks/useCoursePageVisitDatumSummary"
import DebugModal from "@/shared-module/common/components/DebugModal"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Disclosure, QueryResult, Table } from "@/shared-module/components"

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

  return (
    <div
      className={css`
        margin-bottom: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
      `}
    >
      <QueryResult query={query}>
        {() =>
          !aggregatedData || aggregatedData.length === 0 ? null : (
            <>
              <Disclosure
                className={css`
                  margin-bottom: 0.5rem;
                  width: 100%;
                `}
                title={t("header-grouped-by-referrer")}
              >
                <Table
                  caption={t("header-grouped-by-referrer")}
                  density={DENSITY_COMPACT}
                  rows={aggregatedData}
                  rowKey={rowToGroupingKey}
                  columns={[
                    { header: t("header-visit-date"), cell: (row) => row.visit_date },
                    { header: t("header-referrer"), cell: (row) => row.referrer },
                    { header: t("header-number-of-visitors"), cell: (row) => row.num_visitors },
                  ]}
                />
              </Disclosure>
              <DebugModal data={aggregatedData} />
            </>
          )
        }
      </QueryResult>
    </div>
  )
}

function rowToGroupingKey(row: PageVisitDatumSummaryByCourse) {
  return `${row.visit_date}-${row.referrer}`
}

export default withErrorBoundary(DailyVisitCountsGroupedByReferrer)
