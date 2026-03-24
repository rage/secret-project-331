"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { OutputSegment } from "../hooks/useRunOutput"
import { OutputBody, OutputContainer, OutputHeader, OutputHeaderText } from "../styles"

import { RunOutputContent } from "./RunOutputContent"
import { TestResultsContent } from "./TestResultsContent"

import Spinner from "@/shared-module/common/components/Spinner"
import type { RunResult } from "@/tmc/cli"

export type OutputPanelMode = "run" | "test-running" | "test-results"

type OutputPanelProps =
  | {
      mode: "run"
      pyodideLoading?: boolean
      runExecuting?: boolean
      runOutput?: string
      runError?: string | null
      waitingForInput?: boolean
      stdinPrompt?: string
      segments?: OutputSegment[]
      submitStdinLine?: (line: string) => void
    }
  | {
      mode: "test-running"
    }
  | {
      mode: "test-results"
      testResults: RunResult | null
    }

export const OutputPanel: React.FC<OutputPanelProps> = (props) => {
  const { mode } = props
  const pyodideLoading = mode === "run" ? (props.pyodideLoading ?? false) : false
  const runExecuting = mode === "run" ? (props.runExecuting ?? false) : false
  const runOutput = mode === "run" ? (props.runOutput ?? "") : ""
  const runError = mode === "run" ? (props.runError ?? null) : null
  const waitingForInput = mode === "run" ? (props.waitingForInput ?? false) : false
  const stdinPrompt = mode === "run" ? (props.stdinPrompt ?? "") : ""
  const segments = mode === "run" ? (props.segments ?? []) : []
  const submitStdinLine = mode === "run" ? props.submitStdinLine : undefined
  const testResults = mode === "test-results" ? props.testResults : null
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
        {mode === "test-running" && <Spinner />}
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
