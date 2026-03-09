"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { OutputSegment } from "../hooks/useRunOutput"
import { OutputBody, OutputContainer, OutputHeader, OutputHeaderText, OutputPre } from "../styles"

import { RunOutputContent } from "./RunOutputContent"
import { TestResultsContent } from "./TestResultsContent"

import { RunResult } from "@/tmc/cli"

export type OutputPanelMode = "run" | "test-running" | "test-results"

interface OutputPanelProps {
  mode: OutputPanelMode
  /** For run mode */
  pyodideLoading?: boolean
  runExecuting?: boolean
  runOutput?: string
  runError?: string | null
  waitingForInput?: boolean
  stdinPrompt?: string
  segments?: OutputSegment[]
  submitStdinLine?: (line: string) => void
  /** For test-results mode */
  testResults?: RunResult | null
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  mode,
  pyodideLoading = false,
  runExecuting = false,
  runOutput = "",
  runError = null,
  waitingForInput = false,
  stdinPrompt = "",
  segments = [],
  submitStdinLine,
  testResults = null,
}) => {
  const { t } = useTranslation()
  const headerOrange =
    (mode === "run" && (pyodideLoading || runExecuting || waitingForInput)) ||
    mode === "test-running"
  const headerTitle = (() => {
    if (mode === "test-running") {
      return t("running-tests")
    }
    if (mode === "test-results") {
      return t("test-results")
    }
    if (waitingForInput) {
      return t("waiting-for-input")
    }
    if (pyodideLoading) {
      return t("loading-pyodide")
    }
    if (runExecuting) {
      return t("running")
    }
    return t("output")
  })()

  return (
    <OutputContainer>
      <OutputHeader color={headerOrange ? "orange" : "gray"}>
        <OutputHeaderText>{headerTitle}</OutputHeaderText>
      </OutputHeader>
      <OutputBody>
        {mode === "test-running" && <OutputPre>{t("running-tests")}</OutputPre>}
        {mode === "test-results" && testResults != null && (
          <TestResultsContent testResults={testResults} />
        )}
        {mode === "run" && (
          <RunOutputContent
            pyodideLoading={pyodideLoading}
            runExecuting={runExecuting}
            runOutput={runOutput}
            runError={runError}
            waitingForInput={waitingForInput}
            stdinPrompt={stdinPrompt}
            segments={segments}
            submitStdinLine={submitStdinLine}
          />
        )}
      </OutputBody>
    </OutputContainer>
  )
}
