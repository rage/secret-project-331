"use client"

import React from "react"

import { Button } from "@/shared-module/components/components/Button"
import { useTranslation } from "@/utils/useCmsTranslation"

import ChartDataFileSection from "./ChartDataFileSection"
import ChartStepLayout, { stepActionsStyles, stepInstructionStyles } from "./ChartStepLayout"
import type { ChartDataFile } from "./useChartDataFile"

interface ChartDataStepProps {
  stepNumber: number | null
  stepCount: number
  dataFile: ChartDataFile
  dataFileUrl: string | undefined
  onContinue: () => void
}

/**
 * Step 1 — data-first: a brand-new block asks for a data file before anything else, because both
 * ways of making the chart are built around the data's columns.
 */
const ChartDataStep: React.FC<ChartDataStepProps> = ({
  stepNumber,
  stepCount,
  dataFile,
  dataFileUrl,
  onContinue,
}) => {
  const { t } = useTranslation()
  return (
    <ChartStepLayout stepNumber={stepNumber} stepCount={stepCount}>
      <p className={stepInstructionStyles}>{t("chart-block-start-with-data-file")}</p>
      <ChartDataFileSection dataFile={dataFile} dataFileUrl={dataFileUrl} />
      {/* Uploading a file moves on by itself, so this is the way forward for someone who stepped
          back here to check or replace the file. */}
      {dataFileUrl && (
        <div className={stepActionsStyles}>
          <Button variant="primary" size="medium" onPress={onContinue}>
            {t("continue")}
          </Button>
        </div>
      )}
    </ChartStepLayout>
  )
}

export default ChartDataStep
