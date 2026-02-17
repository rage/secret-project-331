"use client"

import React from "react"
import { useTranslation } from "react-i18next"

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
  /** For test-results mode */
  testResults?: RunResult | null
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  mode,
  pyodideLoading = false,
  runExecuting = false,
  runOutput = "",
  runError = null,
  testResults = null,
}) => {
  const { t } = useTranslation()
  const headerOrange =
    (mode === "run" && (pyodideLoading || runExecuting)) || mode === "test-running"
  const headerTitle =
    mode === "test-running"
      ? t("running-tests", "Running tests...")
      : mode === "test-results"
        ? t("test-results", "Test results")
        : pyodideLoading
          ? t("loading-pyodide", "Loading Pyodide...")
          : runExecuting
            ? t("running", "Running...")
            : t("output", "Output")

  return (
    <OutputContainer>
      <OutputHeader color={headerOrange ? "orange" : "gray"}>
        <OutputHeaderText>{headerTitle}</OutputHeaderText>
      </OutputHeader>
      <OutputBody>
        {mode === "test-running" && <OutputPre>{t("running-tests", "Running tests...")}</OutputPre>}
        {mode === "test-results" && testResults != null && (
          <TestResultsContent testResults={testResults} />
        )}
        {mode === "run" && (
          <RunOutputContent
            pyodideLoading={pyodideLoading}
            runExecuting={runExecuting}
            runOutput={runOutput}
            runError={runError}
          />
        )}
      </OutputBody>
    </OutputContainer>
  )
}
