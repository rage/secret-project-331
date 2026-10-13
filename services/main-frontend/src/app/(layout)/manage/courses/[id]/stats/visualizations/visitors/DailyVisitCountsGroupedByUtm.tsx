"use client"

import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { DENSITY_COMPACT } from "@/components/credit-registration/constants"
import type { PageVisitDatumSummaryByCourse } from "@/generated/api/types.generated"
import useCoursePageVisitDatumSummary from "@/hooks/useCoursePageVisitDatumSummary"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Disclosure, QueryResult, Table } from "@/shared-module/components"

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
              <Disclosure
                className={css`
                  width: 100%;
                  margin-bottom: 0.5rem;
                `}
                title={t("header-grouped-by-utm-tags")}
              >
                <Table
                  caption={t("header-grouped-by-utm-tags")}
                  density={DENSITY_COMPACT}
                  rows={aggregatedData}
                  rowKey={rowToGroupingKey}
                  columns={[
                    { header: t("header-visit-date"), cell: (row) => row.visit_date },
                    // oxlint-disable-next-line i18next/no-literal-string
                    { header: "UTM Source", cell: (row) => row.utm_source },
                    // oxlint-disable-next-line i18next/no-literal-string
                    { header: "UTM Medium", cell: (row) => row.utm_medium },
                    // oxlint-disable-next-line i18next/no-literal-string
                    { header: "UTM Campaign", cell: (row) => row.utm_campaign },
                    // oxlint-disable-next-line i18next/no-literal-string
                    { header: "UTM Term", cell: (row) => row.utm_term },
                    // oxlint-disable-next-line i18next/no-literal-string
                    { header: "UTM Content", cell: (row) => row.utm_content },
                    { header: t("header-number-of-visitors"), cell: (row) => row.num_visitors },
                  ]}
                />
              </Disclosure>
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
