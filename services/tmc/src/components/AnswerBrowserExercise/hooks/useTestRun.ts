import { useCallback, useState } from "react"

import type { RunResult } from "@/tmc/cli"
import type { PublicSpec } from "@/util/stateInterfaces"

import { getBrowserTestAdapter, TEST_TIMEOUT_MS } from "../browserTest"
import type { PythonWorker } from "./usePythonWorker"

type TestWorkerResponse =
  | { type: "test_result"; runResult: RunResult }
  | { type: "test_error"; message: string }

function runResultFromError(message: string): RunResult {
  return {
    status: "GENERIC_ERROR",
    testResults: [],
    logs: { error: message },
  }
}

/** Runs the spec's browser tests against the student's file in the shared Python worker. */
export function useTestRun(publicSpec: PublicSpec, pythonWorker: PythonWorker) {
  const [testResults, setTestResults] = useState<RunResult | null>(null)
  const [testInProgress, setTestInProgress] = useState(false)

  const runTests = useCallback(
    async (filepath: string, contents: string) => {
      const browserTest = publicSpec.browser_test
      const script = browserTest?.script
      const adapter = script ? getBrowserTestAdapter(browserTest.runtime) : null
      if (!script || !adapter) {
        setTestResults(runResultFromError("Tests are not available for this exercise."))
        return
      }
      if (!adapter.canRun(filepath)) {
        setTestResults(runResultFromError(adapter.getCannotRunMessage()))
        return
      }

      setTestInProgress(true)
      setTestResults(null)

      const fullScript = adapter.buildScript(script, contents)
      // The budget covers the tests only: it starts once Python has loaded. Pyodide runs far slower
      // than the sandbox the exercise's timeout was set for, hence the floor.
      const timeoutMs = Math.max(browserTest.timeout_ms ?? 0, TEST_TIMEOUT_MS)

      const runInWorker = (worker: Worker): Promise<TestWorkerResponse> =>
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            settle()
            pythonWorker.discard()
            reject(new Error("Test run timed out"))
          }, timeoutMs)
          const settle = () => {
            clearTimeout(timeout)
            // oxlint-disable-next-line unicorn/prefer-add-event-listener -- handler cleanup; `= null` has no addEventListener form
            worker.onmessage = null
            // oxlint-disable-next-line unicorn/prefer-add-event-listener -- handler cleanup; `= null` has no addEventListener form
            worker.onerror = null
          }
          // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
          worker.onmessage = (e: MessageEvent<TestWorkerResponse>) => {
            settle()
            resolve(e.data)
          }
          // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
          worker.onerror = (ev: ErrorEvent) => {
            settle()
            pythonWorker.discard()
            reject(new Error(ev.message?.trim() ? ev.message : "Worker error"))
          }
          // oxlint-disable-next-line unicorn/require-post-message-target-origin -- postMessage has no targetOrigin param
          worker.postMessage({ type: "test", script: fullScript })
        })

      try {
        const response = await runInWorker(await pythonWorker.acquire())
        setTestResults(
          response.type === "test_result"
            ? response.runResult
            : runResultFromError(response.message),
        )
      } catch (err) {
        setTestResults(runResultFromError(err instanceof Error ? err.message : String(err)))
      } finally {
        setTestInProgress(false)
      }
    },
    [publicSpec.browser_test, pythonWorker],
  )

  return { testResults, testInProgress, runTests }
}
