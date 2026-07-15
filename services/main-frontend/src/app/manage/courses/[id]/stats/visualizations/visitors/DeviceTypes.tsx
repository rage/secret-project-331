"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { getCoursePageVisitDatumSummaryByDeviceTypesOptions } from "@/generated/api/@tanstack/react-query.generated"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

import { DEFAULT_CHART_HEIGHT, InstructionBox } from "../../CourseStatsPage"
import Echarts from "../../Echarts"
import StatsHeader from "../../StatsHeader"
import NoDataMessage from "../NoDataMessage"

export interface DeviceTypesProps {
  courseId: string
}

const containerStyles = css`
  margin-bottom: 2rem;
  border: 3px solid ${baseTheme.colors.clear[200]};
  border-radius: 6px;
  padding: 1rem;
  min-height: ${DEFAULT_CHART_HEIGHT}px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const chartsContainerStyles = css`
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  justify-content: center;
  align-content: space-between;
  width: 100%;

  > div {
    width: 500px;
  }
`

const DeviceTypes: React.FC<React.PropsWithChildren<DeviceTypesProps>> = ({ courseId }) => {
  const query = useQuery({
    ...getCoursePageVisitDatumSummaryByDeviceTypesOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

  const { t } = useTranslation()

  const aggregatedDataDeviceType = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return null
    }
    const allDeviceTypesInData = Array.from(new Set(query.data.map((d) => d.device_type)))
    const aggregatedData: Record<string, number> = {}
    allDeviceTypesInData.forEach((deviceType) => {
      const deviceTypeData = query.data.filter((d) => d.device_type === deviceType)
      // oxlint-disable-next-line i18next/no-literal-string
      aggregatedData[deviceType ?? "null"] = deviceTypeData.reduce(
        (acc, curr) => acc + curr.num_visitors,
        0,
      )
    })
    return aggregatedData
  }, [query.data])

  const aggregatedDataOperatingSystem = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return null
    }
    const allOperatingSystemsInData = Array.from(new Set(query.data.map((d) => d.operating_system)))
    const aggregatedData: Record<string, number> = {}
    allOperatingSystemsInData.forEach((operatingSystem) => {
      const operatingSystemData = query.data.filter((d) => d.operating_system === operatingSystem)
      // oxlint-disable-next-line i18next/no-literal-string
      aggregatedData[operatingSystem ?? "null"] = operatingSystemData.reduce(
        (acc, curr) => acc + curr.num_visitors,
        0,
      )
    })
    return aggregatedData
  }, [query.data])

  const aggregatedDataBrowser = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return null
    }
    const allBrowsersInData = Array.from(new Set(query.data.map((d) => d.browser)))
    const aggregatedData: Record<string, number> = {}
    allBrowsersInData.forEach((browser) => {
      const browserData = query.data.filter((d) => d.browser === browser)
      // oxlint-disable-next-line i18next/no-literal-string
      aggregatedData[browser ?? "null"] = browserData.reduce(
        (acc, curr) => acc + curr.num_visitors,
        0,
      )
    })
    return aggregatedData
  }, [query.data])

  const hasData = aggregatedDataDeviceType && aggregatedDataOperatingSystem && aggregatedDataBrowser

  return (
    <>
      <StatsHeader
        heading={t("stats-heading-device-analytics")}
        debugData={aggregatedDataDeviceType}
      />
      <InstructionBox>{t("stats-instruction-device-analytics")}</InstructionBox>
      <div className={containerStyles}>
        <QueryResult query={query} emptyFallback={<NoDataMessage />}>
          {() =>
            !hasData ? (
              <NoDataMessage />
            ) : (
              <div className={chartsContainerStyles}>
                <div>
                  <Echarts
                    height={DEFAULT_CHART_HEIGHT}
                    options={{
                      tooltip: {
                        // oxlint-disable-next-line i18next/no-literal-string
                        trigger: "item",
                        // oxlint-disable-next-line i18next/no-literal-string
                        formatter: "{b}: {c} ({d}%)",
                      },
                      title: {
                        text: t("title-device-type"),
                        // oxlint-disable-next-line i18next/no-literal-string
                        left: "center",
                      },
                      series: [
                        {
                          type: "pie",
                          radius: "50%",
                          data: Object.entries(aggregatedDataDeviceType).map(
                            ([deviceType, visitors]) => ({
                              name: deviceType,
                              value: visitors,
                            }),
                          ),
                          emphasis: {
                            itemStyle: {
                              shadowBlur: 10,
                              shadowOffsetX: 0,
                              shadowColor: "rgba(0, 0, 0, 0.5)",
                            },
                          },
                        },
                      ],
                    }}
                  />
                </div>

                <div>
                  <Echarts
                    height={DEFAULT_CHART_HEIGHT}
                    options={{
                      tooltip: {
                        // oxlint-disable-next-line i18next/no-literal-string
                        trigger: "item",
                        // oxlint-disable-next-line i18next/no-literal-string
                        formatter: "{b}: {c} ({d}%)",
                      },
                      title: {
                        text: t("title-operating-system"),
                        // oxlint-disable-next-line i18next/no-literal-string
                        left: "center",
                      },
                      series: [
                        {
                          type: "pie",
                          radius: "50%",
                          data: Object.entries(aggregatedDataOperatingSystem).map(
                            ([operatingSystem, visitors]) => ({
                              name: operatingSystem,
                              value: visitors,
                            }),
                          ),
                          emphasis: {
                            itemStyle: {
                              shadowBlur: 10,
                              shadowOffsetX: 0,
                              shadowColor: "rgba(0, 0, 0, 0.5)",
                            },
                          },
                        },
                      ],
                    }}
                  />
                </div>

                <div>
                  <Echarts
                    height={DEFAULT_CHART_HEIGHT}
                    options={{
                      tooltip: {
                        // oxlint-disable-next-line i18next/no-literal-string
                        trigger: "item",
                        // oxlint-disable-next-line i18next/no-literal-string
                        formatter: "{b}: {c} ({d}%)",
                      },
                      title: {
                        text: t("title-browser"),
                        // oxlint-disable-next-line i18next/no-literal-string
                        left: "center",
                      },
                      series: [
                        {
                          type: "pie",
                          radius: "50%",
                          data: Object.entries(aggregatedDataBrowser).map(
                            ([browser, visitors]) => ({
                              name: browser,
                              value: visitors,
                            }),
                          ),
                          emphasis: {
                            itemStyle: {
                              shadowBlur: 10,
                              shadowOffsetX: 0,
                              shadowColor: "rgba(0, 0, 0, 0.5)",
                            },
                          },
                        },
                      ],
                    }}
                  />
                </div>
              </div>
            )
          }
        </QueryResult>
      </div>
    </>
  )
}

export default withErrorBoundary(DeviceTypes)
