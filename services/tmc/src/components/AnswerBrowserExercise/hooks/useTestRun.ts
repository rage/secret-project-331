"use client"

import { useState } from "react"

import { RunResult } from "@/tmc/cli"
import { runBrowserTests, waitForTestResults } from "@/util/requests"

export function useTestRun(stubDownloadUrl: string) {
  const [testResults, setTestResults] = useState<RunResult | null>(null)
  const [testInProgress, setTestInProgress] = useState(false)

  const runTests = async (filepath: string, contents: string) => {
    setTestInProgress(true)
    setTestResults(null)
    try {
      const testRunId = await runBrowserTests(stubDownloadUrl, filepath, contents)
      const result = await waitForTestResults(testRunId)
      setTestResults(result ?? null)
    } finally {
      setTestInProgress(false)
    }
  }

  return { testResults, testInProgress, runTests }
}
