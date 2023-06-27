import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"

import { fetchCoursePageVisitDatumSummariesByDeviceTypes } from "../../../../../../services/backend/courses"
import DebugModal from "../../../../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { baseTheme } from "../../../../../../shared-module/styles"
import { dontRenderUntilQueryParametersReady } from "../../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../../../shared-module/utils/withErrorBoundary"

import Echarts from "./Echarts"

export interface DeviceTypesProps {
  courseId: string
}

const DeviceTypes: React.FC<React.PropsWithChildren<DeviceTypesProps>> = ({ courseId }) => {
  const query = useQuery([`course-page-visit-datum-summary-by-device-type-${courseId}`], () =>
    fetchCoursePageVisitDatumSummariesByDeviceTypes(courseId),
  )

  const aggregatedDataDeviceType = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return null
    }
    const allDeviceTypesInData = Array.from(new Set(query.data.map((d) => d.device_type)))
    const aggregatedData: Record<string, number> = {}
    allDeviceTypesInData.forEach((deviceType) => {
      const deviceTypeData = query.data.filter((d) => d.device_type === deviceType)
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
      aggregatedData[browser ?? "null"] = browserData.reduce(
        (acc, curr) => acc + curr.num_visitors,
        0,
      )
    })
    return aggregatedData
  }, [query.data])

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
      <div
        className={css`
          margin-bottom: 1.5rem;
          border: 3px solid ${baseTheme.colors.clear[200]};
          border-radius: 6px;
          padding: 1rem;
        `}
      >
        <div
          className={css`
            display: flex;
            flex-wrap: wrap;
            flex-direction: row;
            justify-content: center;
            align-content: space-between;

            > div {
              width: 500px;
            }
          `}
        >
          {aggregatedDataDeviceType && (
            <div>
              <Echarts
                height={500}
                options={{
                  tooltip: {
                    trigger: "item",
                    formatter: "{b}: {c} ({d}%)",
                  },
                  title: {
                    text: "Device type",
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
          )}

          {aggregatedDataOperatingSystem && (
            <div>
              <Echarts
                height={500}
                options={{
                  tooltip: {
                    trigger: "item",
                    formatter: "{b}: {c} ({d}%)",
                  },
                  title: {
                    text: "Operating System",
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
          )}

          {aggregatedDataBrowser && (
            <div>
              <Echarts
                height={500}
                options={{
                  tooltip: {
                    trigger: "item",
                    formatter: "{b}: {c} ({d}%)",
                  },
                  title: {
                    text: "Browser",
                    left: "center",
                  },
                  series: [
                    {
                      type: "pie",
                      radius: "50%",
                      data: Object.entries(aggregatedDataBrowser).map(([browser, visitors]) => ({
                        name: browser,
                        value: visitors,
                      })),
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
          )}
        </div>

        <DebugModal data={aggregatedDataDeviceType} />
      </div>
    </div>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(DeviceTypes))
