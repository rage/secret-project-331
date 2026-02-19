"use client"

import { useCallback, useRef, useState } from "react"

import { getBrowserTestAdapter, TEST_TIMEOUT_MS_EXPORT as TEST_TIMEOUT_MS } from "../browserTest"

import { RunResult } from "@/tmc/cli"
import { PublicSpec } from "@/util/stateInterfaces"

/** Worker response: RunResult on success or error message. */
type TestWorkerResponse = { runResult: RunResult } | { error: string }

function runResultFromError(message: string): RunResult {
  return {
    status: "GENERIC_ERROR",
    testResults: [],
    logs: { error: message },
  }
}

export function useTestRun(publicSpec: PublicSpec) {
  const [testResults, setTestResults] = useState<RunResult | null>(null)
  const [testInProgress, setTestInProgress] = useState(false)
  const workerRef = useRef<Worker | null>(null)

  const runTests = useCallback(
    async (filepath: string, contents: string) => {
      const browserTest = publicSpec.browser_test
      const script = browserTest?.script
      if (!script) {
        setTestResults(runResultFromError("Tests are not available for this exercise."))
        return
      }
      const adapter =
        browserTest?.runtime != null ? getBrowserTestAdapter(browserTest.runtime) : null
      if (!adapter?.canRun(filepath)) {
        setTestResults(runResultFromError("Only Python files can be tested."))
        return
      }

      setTestInProgress(true)
      setTestResults(null)

      const fullScript = adapter.buildScript(script, contents)

      const runInWorker = (): Promise<TestWorkerResponse> =>
        new Promise((resolve, reject) => {
          const worker = workerRef.current ?? new Worker(adapter.getWorkerUrl())
          workerRef.current = worker

          const timeout = setTimeout(() => {
            worker.onmessage = null
            worker.onerror = null
            reject(new Error("Test run timed out"))
          }, TEST_TIMEOUT_MS)

          worker.onmessage = (e: MessageEvent<TestWorkerResponse>) => {
            clearTimeout(timeout)
            worker.onmessage = null
            worker.onerror = null
            resolve(e.data)
          }
          worker.onerror = () => {
            clearTimeout(timeout)
            worker.onmessage = null
            worker.onerror = null
            reject(new Error("Worker error"))
          }
          worker.postMessage({ script: fullScript })
        })

      try {
        const response = await runInWorker()
        if ("error" in response) {
          setTestResults(runResultFromError(response.error))
        } else {
          setTestResults(response.runResult)
        }
      } catch (err) {
        setTestResults(runResultFromError(err instanceof Error ? err.message : String(err)))
      } finally {
        setTestInProgress(false)
      }
    },
    [publicSpec.browser_test],
  )

  return { testResults, testInProgress, runTests }
}
