import { useCallback, useRef, useState } from "react"

import type { RunResult } from "@/tmc/cli"
import type { PublicSpec } from "@/util/stateInterfaces"

import { getBrowserTestAdapter, TEST_TIMEOUT_MS } from "../browserTest"

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
        browserTest?.runtime !== undefined ? getBrowserTestAdapter(browserTest.runtime) : null
      if (!adapter) {
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

      const runInWorker = (): Promise<TestWorkerResponse> =>
        new Promise((resolve, reject) => {
          const worker = workerRef.current ?? new Worker(adapter.getWorkerUrl())
          workerRef.current = worker

          const timeout = setTimeout(() => {
            // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
            worker.onmessage = null
            // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
            worker.onerror = null
            worker.terminate()
            if (workerRef.current === worker) {
              workerRef.current = null
            }
            reject(new Error("Test run timed out"))
          }, TEST_TIMEOUT_MS)

          // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
          worker.onmessage = (e: MessageEvent<TestWorkerResponse>) => {
            clearTimeout(timeout)
            // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
            worker.onmessage = null
            // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
            worker.onerror = null
            resolve(e.data)
          }
          // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
          worker.onerror = (ev: ErrorEvent) => {
            clearTimeout(timeout)
            // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
            worker.onmessage = null
            // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
            worker.onerror = null
            worker.terminate()
            if (workerRef.current === worker) {
              workerRef.current = null
            }
            const message =
              ev?.message !== undefined && String(ev.message).trim() !== ""
                ? String(ev.message)
                : "Worker error"
            reject(new Error(message))
          }
          // oxlint-disable-next-line unicorn/require-post-message-target-origin -- postMessage has no targetOrigin param
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
