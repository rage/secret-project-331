"use client"

import { css } from "@emotion/css"
import React from "react"
import type { Control } from "react-hook-form"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { baseTheme, fontWeights, primaryFont } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components/components/Button"
import { TextArea } from "@/shared-module/components/components/TextArea"
import { useTranslation } from "@/utils/useCmsTranslation"

import ChartStepLayout from "./ChartStepLayout"

interface ChartAiPromptStepProps {
  stepNumber: number | null
  stepCount: number
  control: Control<{ aiPrompt: string }>
  /** The prompt as typed, for enabling the generate button. */
  prompt: string
  isGenerating: boolean
  /** The model needs the data's columns, so there is nothing to generate from without a file. */
  hasDataFile: boolean
  error: unknown
  /** Rewriting a finished chart rather than writing one as part of the guided flow. */
  isRegenerating: boolean
  onCancel: () => void
  onGenerate: () => void
}

/** Step 3a — describe the chart and let the model write the specification. */
const ChartAiPromptStep: React.FC<ChartAiPromptStepProps> = ({
  stepNumber,
  stepCount,
  control,
  prompt,
  isGenerating,
  hasDataFile,
  error,
  isRegenerating,
  onCancel,
  onGenerate,
}) => {
  const { t } = useTranslation()
  return (
    <ChartStepLayout stepNumber={stepNumber} stepCount={stepCount}>
      <TextArea
        name="aiPrompt"
        control={control}
        label={t("ai-chart-prompt-label")}
        placeholder={t("ai-chart-prompt-placeholder")}
        rows={4}
        isDisabled={isGenerating}
      />
      {!isGenerating && !hasDataFile && (
        <span
          className={css`
            font-family: ${primaryFont};
            font-size: 0.8125rem;
            font-weight: ${fontWeights.medium};
            color: ${baseTheme.colors.red[600]};
          `}
        >
          {t("ai-generate-needs-data-file")}
        </span>
      )}
      {/* The live region must exist before content changes for screen readers to announce it. */}
      <div aria-live="polite">
        {isGenerating && (
          <span
            className={css`
              font-family: ${primaryFont};
              font-size: 0.8125rem;
              color: ${baseTheme.colors.gray[600]};
            `}
          >
            {t("ai-generating-chart")}
          </span>
        )}
      </div>
      {error !== null && <ErrorBanner error={error} />}
      <div
        className={css`
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        `}
      >
        <Button variant="secondary" size="medium" onPress={onCancel} disabled={isGenerating}>
          {isRegenerating ? t("cancel") : t("back")}
        </Button>
        <Button
          variant="primary"
          size="medium"
          onPress={onGenerate}
          isLoading={isGenerating}
          disabled={!prompt.trim() || !hasDataFile}
        >
          {t("generate")}
        </Button>
      </div>
    </ChartStepLayout>
  )
}

export default ChartAiPromptStep
