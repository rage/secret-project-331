"use client"

import { css } from "@emotion/css"
import type { EChartsOption } from "echarts"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const ReactECharts = dynamicImport<{
  option: EChartsOption
  style?: React.CSSProperties | undefined
}>(() => import("echarts-for-react"))

export interface EchartsProps {
  options: EChartsOption
  height?: number
  /** Chart name from its section heading; spoken before the generated ECharts summary. */
  label?: string
}

const Echarts: React.FC<React.PropsWithChildren<EchartsProps>> = ({
  options,
  height = 300,
  label,
}) => {
  const { t } = useTranslation()
  const accessibleOptions = useMemo<EChartsOption>(() => {
    const name = label ? t("chart-label", { title: label }) : undefined
    return {
      ...options,
      aria: {
        enabled: true,
        ...(name ? { label: { general: { withTitle: name, withoutTitle: name } } } : {}),
        ...(options.aria as object | undefined),
      },
    }
  }, [options, label, t])
  return (
    <div
      className={css`
        width: 100%;
        /* echarts writes a pixel width onto its own container once initialised, and a chart in a
           grid or flex track would otherwise size the whole page by it. Contained here so no
           consumer has to wrap the chart to stop it. */
        min-width: 0;
        overflow-x: hidden;
      `}
    >
      {/* oxlint-disable-next-line react/forbid-component-props */}
      <ReactECharts style={{ height }} option={accessibleOptions} />
    </div>
  )
}

export default withErrorBoundary(Echarts)
