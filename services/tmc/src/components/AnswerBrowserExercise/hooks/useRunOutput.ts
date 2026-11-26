import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { postStdinLine } from "@/util/stdinServiceWorker"

import type { PythonWorker } from "./usePythonWorker"

export type OutputSegment =
  | { type: "stdout"; text: string }
  | { type: "input"; prompt: string; line: string }

export function useRunOutput(pythonWorker: PythonWorker) {
  const [segments, setSegments] = useState<OutputSegment[]>([])
  const [runError, setRunError] = useState<string | null>(null)
  const [pyodideLoading, setPyodideLoading] = useState(false)
  const [runExecuting, setRunExecuting] = useState(false)
  const [waitingForInput, setWaitingForInput] = useState(false)
  const [stdinPrompt, setStdinPrompt] = useState("")
  const workerRef = useRef<Worker | null>(null)
  /** Set while a blocking input() waits on the stdin service worker for its line. */
  const stdinRequestIdRef = useRef<string | null>(null)
  const latestRunRef = useRef(0)
  const runOutputBufferRef = useRef("")
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const runOutput = useMemo(
    () =>
      segments
        .filter((s) => s.type === "stdout")
        .map((s) => s.text)
        .join(""),
    [segments],
  )

  const submitStdinLine = useCallback((line: string) => {
    setSegments((prev) => {
      let i = prev.length - 1
      while (i >= 0) {
        const seg = prev[i]
        if (seg?.type === "input" && seg.line === "") {
          return [
            ...prev.slice(0, i),
            { type: "input" as const, prompt: seg.prompt, line },
            ...prev.slice(i + 1),
          ]
        }
        i -= 1
      }
      return prev
    })
    setWaitingForInput(false)
    setStdinPrompt("")
    const requestId = stdinRequestIdRef.current
    stdinRequestIdRef.current = null
    if (requestId === null) {
      workerRef.current?.postMessage({ type: "stdin_line", line })
    } else {
      void postStdinLine(requestId, line)
    }
  }, [])

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearInterval(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }, [])

  useEffect(() => clearFlushTimer, [clearFlushTimer])

  const stopRun = useCallback(() => {
    latestRunRef.current++
    clearFlushTimer()
    setPyodideLoading(false)
    setRunExecuting(false)
    setWaitingForInput(false)
    setStdinPrompt("")
    workerRef.current = null
    stdinRequestIdRef.current = null
    // Python cannot be interrupted, so stopping costs the worker.
    pythonWorker.discard()
  }, [pythonWorker, clearFlushTimer])

  const runPython = useCallback(
    async (contents: string, filepath: string) => {
      if (runExecuting) {
        stopRun()
      }
      const runToken = ++latestRunRef.current

      setRunError(null)
      runOutputBufferRef.current = ""
      setSegments([])
      setWaitingForInput(false)
      setStdinPrompt("")
      setPyodideLoading(true)
      setRunExecuting(true)

      const finish = (error: string | null) => {
        setRunError(error)
        setPyodideLoading(false)
        setRunExecuting(false)
        setWaitingForInput(false)
        setStdinPrompt("")
      }

      let worker: Worker
      try {
        worker = await pythonWorker.acquire()
      } catch (err) {
        if (runToken === latestRunRef.current) {
          finish(err instanceof Error ? err.message : String(err))
        }
        return
      }
      if (runToken !== latestRunRef.current) {
        return
      }
      workerRef.current = worker
      setPyodideLoading(false)

      const flushStdout = () => {
        const pending = runOutputBufferRef.current
        if (pending.length === 0) {
          return
        }
        runOutputBufferRef.current = ""
        setSegments((prev) => {
          const last = prev.at(-1)
          if (last?.type === "stdout") {
            return [...prev.slice(0, -1), { type: "stdout", text: last.text + pending }]
          }
          return [...prev, { type: "stdout", text: pending }]
        })
      }

      const end = (error: string | null) => {
        clearFlushTimer()
        flushStdout()
        // oxlint-disable-next-line unicorn/prefer-add-event-listener -- handler cleanup; `= null` has no addEventListener form
        worker.onmessage = null
        // oxlint-disable-next-line unicorn/prefer-add-event-listener -- handler cleanup; `= null` has no addEventListener form
        worker.onerror = null
        workerRef.current = null
        finish(error)
      }

      clearFlushTimer()
      flushTimerRef.current = setInterval(flushStdout, 50)

      // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
      worker.onmessage = (e: MessageEvent) => {
        const data = e.data
        switch (data.type) {
          case "stdout":
          case "stderr": {
            const chunk = data.chunk ?? ""
            runOutputBufferRef.current += chunk
            if (chunk.includes("\n")) {
              flushStdout()
            }
            break
          }
          case "stdin_request":
            stdinRequestIdRef.current = typeof data.id === "string" ? data.id : null
            flushStdout()
            setSegments((prev) => [...prev, { type: "input", prompt: data.prompt ?? "", line: "" }])
            setStdinPrompt(data.prompt ?? "")
            setWaitingForInput(true)
            break
          case "run_done":
            end(null)
            break
          case "run_error":
            end(data.message ?? "Unknown error")
            break
          default:
            break
        }
      }
      // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
      worker.onerror = () => {
        end("Worker error")
        pythonWorker.discard()
      }
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- postMessage has no targetOrigin param
      worker.postMessage({ type: "run", source: contents, filename: filepath })
    },
    [runExecuting, stopRun, pythonWorker, clearFlushTimer],
  )

  return {
    segments,
    runOutput,
    runError,
    pyodideLoading,
    runExecuting,
    runPython,
    stopRun,
    waitingForInput,
    stdinPrompt,
    submitStdinLine,
  }
}
