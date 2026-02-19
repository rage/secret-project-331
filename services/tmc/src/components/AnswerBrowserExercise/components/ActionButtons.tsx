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
  TestUnavailableHint,
} from "../styles"

interface ActionButtonsProps {
  isPython: boolean
  runDisabled: boolean
  testDisabled: boolean
  testInProgress: boolean
  showRun: boolean
  contents: string
  onRun: (contents: string) => void
  onTest: () => Promise<void>
  onResetClick: () => void
  /** When Test is disabled because the server could not build the test script (e.g. template missing test/tmc). */
  testUnavailableReason?: string
}

export const ActionButtons: React.FC<ActionButtonsProps> = (p) => {
  const { t } = useTranslation()
  return (
    <>
      <ButtonRow>
        {p.isPython &&
          (p.showRun ? (
            <RunButton
              type="button"
              disabled={p.runDisabled}
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
            disabled={p.testDisabled}
            onClick={p.onTest}
            data-cy="test-btn"
            title={p.testUnavailableReason ?? undefined}
          >
            <EyeIcon />
            <TestButtonLabel>{t("test", "Test")}</TestButtonLabel>
          </TestButton>
        )}
        <ResetButton type="button" data-cy="reset-btn" onClick={p.onResetClick}>
          {t("reset", "Reset")}
        </ResetButton>
      </ButtonRow>
      {p.testUnavailableReason && (
        <TestUnavailableHint>
          {t("tests-unavailable", "Tests unavailable")}: {p.testUnavailableReason}
        </TestUnavailableHint>
      )}
    </>
  )
}
