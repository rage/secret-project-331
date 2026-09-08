"use client"

import { css } from "@emotion/css"
import React from "react"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { baseTheme, fontWeights, primaryFont } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components/components/Button"
import { useTranslation } from "@/utils/useCmsTranslation"

import ChartPreview from "./ChartPreview"

const paneTitleStyles = css`
  margin: 0 0 0.5rem;
  font-family: ${primaryFont};
  font-size: 0.8125rem;
  color: ${baseTheme.colors.gray[700]};
  font-weight: ${fontWeights.medium};
`

interface ChartPreviewPaneProps {
  spec: string
  height: number
  heightIsAuto: boolean
  caption: string
  /** Why the chart won't render, or null when it does. */
  renderError: string | null
  /** Separates a spec that isn't JSON at all from one that is but won't compile. */
  isValidJson: boolean
  isGenerating: boolean
  aiError: unknown
  onFixWithAi: () => void
}

/** The chart as the student will see it, and what to do when it won't render. */
const ChartPreviewPane: React.FC<ChartPreviewPaneProps> = ({
  spec,
  height,
  heightIsAuto,
  caption,
  renderError,
  isValidJson,
  isGenerating,
  aiError,
  onFixWithAi,
}) => {
  const { t } = useTranslation()
  return (
    <>
      <p className={paneTitleStyles}>{t("preview")}</p>
      <div
        className={css`
          flex: 1;
          min-height: 0;
          overflow: auto;
        `}
      >
        <ChartPreview
          spec={spec}
          height={height}
          heightIsAuto={heightIsAuto}
          caption={caption}
          showCaption
          warnOnMobileOverflow
        />
      </div>
      {renderError && (
        <div
          className={css`
            flex-shrink: 0;
            margin-top: 0.75rem;
            padding: 0.75rem 1rem;
            background: ${baseTheme.colors.red[100]};
            border: 1px solid ${baseTheme.colors.red[400]};
            border-radius: 4px;
          `}
        >
          <p
            className={css`
              margin: 0 0 0.25rem;
              font-family: ${primaryFont};
              font-size: 0.8125rem;
              font-weight: ${fontWeights.medium};
              color: ${baseTheme.colors.red[700]};
            `}
          >
            {isValidJson ? t("chart-render-error") : t("invalid-json")}
          </p>
          <p
            className={css`
              margin: 0 0 0.75rem;
              font-family: ${primaryFont};
              font-size: 0.75rem;
              color: ${baseTheme.colors.gray[700]};
              overflow-wrap: break-word;
            `}
          >
            {renderError}
          </p>
          <Button variant="primary" size="small" onPress={onFixWithAi} isLoading={isGenerating}>
            {t("fix-with-ai")}
          </Button>
          {aiError !== null && (
            <div
              className={css`
                margin-top: 0.5rem;
              `}
            >
              <ErrorBanner error={aiError} />
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default ChartPreviewPane
