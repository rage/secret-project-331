"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { EyeIcon, PlayIcon, StopIcon } from "../icons"
import {
  ButtonRow,
  ResetButton,
  RunButton,
  StopButton,
  TestButton,
  TestButtonLabel,
} from "../styles"

interface ActionButtonsProps {
  isPython: boolean
  runOrTestDisabled: boolean
  testInProgress: boolean
  showRun: boolean
  contents: string
  onRun: (contents: string) => void
  onTest: () => Promise<void>
  onResetClick: () => void
}

export const ActionButtons: React.FC<ActionButtonsProps> = (p) => {
  const { t } = useTranslation()
  return (
    <ButtonRow>
      {p.isPython &&
        (p.showRun ? (
          <RunButton
            type="button"
            disabled={p.runOrTestDisabled}
            onClick={() => p.onRun(p.contents)}
            data-cy="run-btn"
          >
            <PlayIcon />
            <span>{t("run", "Run")}</span>
          </RunButton>
        ) : (
          <StopButton type="button" disabled data-cy="stop-btn">
            <StopIcon />
            <span>{t("stop", "Stop")}</span>
          </StopButton>
        ))}
      {p.isPython && (
        <TestButton
          type="button"
          disabled={p.runOrTestDisabled || p.testInProgress}
          onClick={p.onTest}
          data-cy="test-btn"
        >
          <EyeIcon />
          <TestButtonLabel>{t("test", "Test")}</TestButtonLabel>
        </TestButton>
      )}
      <ResetButton type="button" data-cy="reset-btn" onClick={p.onResetClick}>
        {t("reset", "Reset")}
      </ResetButton>
    </ButtonRow>
  )
}
