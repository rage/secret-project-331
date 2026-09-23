"use client"

import { css } from "@emotion/css"
import React from "react"

import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components/components/Button"
import { useTranslation } from "@/utils/useCmsTranslation"

import ChartStepLayout, { stepActionsStyles, stepInstructionStyles } from "./ChartStepLayout"

const AI_OPTION_DESCRIPTION_ID = "chart-block-ai-option-description"
const MANUAL_OPTION_DESCRIPTION_ID = "chart-block-manual-option-description"

// Vega-Altair writes Vega-Lite specifications from Python, which is a far friendlier way to author
// one than typing the JSON by hand.
const VEGA_ALTAIR_URL = "https://altair-viz.github.io/"

const methodOptionStyles = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid ${baseTheme.colors.gray[300]};
  border-radius: 4px;
`

const methodOptionDescriptionStyles = css`
  margin: 0;
  font-family: ${primaryFont};
  font-size: 0.8125rem;
  color: ${baseTheme.colors.gray[600]};
`

const methodOptionLinkStyles = css`
  font-family: ${primaryFont};
  font-size: 0.8125rem;
`

interface ChartMethodStepProps {
  stepNumber: number | null
  stepCount: number
  onGenerateWithAi: () => void
  onWriteManually: () => void
  onBack: () => void
}

/** Step 2 — how the chart itself gets written. */
const ChartMethodStep: React.FC<ChartMethodStepProps> = ({
  stepNumber,
  stepCount,
  onGenerateWithAi,
  onWriteManually,
  onBack,
}) => {
  const { t } = useTranslation()
  return (
    <ChartStepLayout stepNumber={stepNumber} stepCount={stepCount}>
      <p className={stepInstructionStyles}>{t("chart-block-choose-creation-method")}</p>
      <div className={methodOptionStyles}>
        <Button
          variant="primary"
          size="medium"
          onPress={onGenerateWithAi}
          aria-describedby={AI_OPTION_DESCRIPTION_ID}
        >
          {t("ai-generate-chart")}
        </Button>
        <p id={AI_OPTION_DESCRIPTION_ID} className={methodOptionDescriptionStyles}>
          {t("chart-creation-method-ai-description")}
        </p>
      </div>
      <div className={methodOptionStyles}>
        <Button
          variant="secondary"
          size="medium"
          onPress={onWriteManually}
          aria-describedby={MANUAL_OPTION_DESCRIPTION_ID}
        >
          {t("write-vega-json-manually")}
        </Button>
        <p id={MANUAL_OPTION_DESCRIPTION_ID} className={methodOptionDescriptionStyles}>
          {t("chart-creation-method-manual-description")}
        </p>
        <a
          className={methodOptionLinkStyles}
          href={VEGA_ALTAIR_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("vega-altair-documentation")}
        </a>
      </div>
      <div className={stepActionsStyles}>
        <Button variant="tertiary" size="medium" onPress={onBack}>
          {t("back")}
        </Button>
      </div>
    </ChartStepLayout>
  )
}

export default ChartMethodStep
