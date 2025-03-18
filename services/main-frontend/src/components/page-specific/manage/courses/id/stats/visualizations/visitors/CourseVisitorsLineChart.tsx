import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import LineChart, {
  DAILY_DATE_FORMAT,
  MONTHLY_DATE_FORMAT,
  MONTHLY_PERIOD,
  Period,
} from "../../LineChart"

import useCoursePageVisitDatumSummary from "@/hooks/useCoursePageVisitDatumSummary"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface CourseVisitorsLineChartProps {
  courseId: string
}

const DAYS_TO_SHOW = 90

const CourseVisitorsLineChart: React.FC<React.PropsWithChildren<CourseVisitorsLineChartProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)
  const query = useCoursePageVisitDatumSummary(courseId)

  const processedData = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return []
    }

    const visitorsByDate = query.data.reduce<{ [date: string]: number }>((acc, item) => {
      acc[item.visit_date] = (acc[item.visit_date] || 0) + item.num_visitors
      return acc
    }, {})

    const dateEntries = Object.entries(visitorsByDate).map(([date, count]) => ({
      period: date,
      count,
    }))

    dateEntries.sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime())

    if (period === MONTHLY_PERIOD) {
      const monthlyData: { [month: string]: number } = {}

      dateEntries.forEach((entry) => {
        const date = new Date(entry.period)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + entry.count
      })

      return Object.entries(monthlyData).map(([date, value]) => ({
        period: date,
        count: value,
      }))
    }

    if (dateEntries.length > DAYS_TO_SHOW) {
      return dateEntries.slice(dateEntries.length - DAYS_TO_SHOW)
    }

    return dateEntries
  }, [query.data, period])

  return (
    <LineChart
      data={processedData}
      isLoading={query.isPending}
      error={query.error}
      period={period}
      setPeriod={setPeriod}
      yAxisName={t("visitors")}
      tooltipValueLabel={t("visitors")}
      dateFormat={period === MONTHLY_PERIOD ? MONTHLY_DATE_FORMAT : DAILY_DATE_FORMAT}
      statHeading={t("stats-heading-course-visitors")}
      instructionText={t("stats-instruction-course-visitors")}
    />
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CourseVisitorsLineChart))
