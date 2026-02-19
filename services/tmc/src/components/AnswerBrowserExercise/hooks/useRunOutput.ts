"use client"

import { useCallback, useRef, useState } from "react"

function getRunWorkerUrl(): string {
  const base = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BASE_PATH
  return `${base ?? ""}/runWorker.js`
}

export function useRunOutput() {
  const [runOutput, setRunOutput] = useState("")
  const [runError, setRunError] = useState<string | null>(null)
  const [pyodideLoading, setPyodideLoading] = useState(false)
  const [runExecuting, setRunExecuting] = useState(false)
  const [waitingForInput, setWaitingForInput] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const runOutputBufferRef = useRef("")

  const submitStdinLine = useCallback((line: string) => {
    workerRef.current?.postMessage({ type: "stdin_line", line })
  }, [])

  const runPython = useCallback(async (contents: string) => {
    setRunError(null)
    runOutputBufferRef.current = ""
    setRunOutput("")
    setWaitingForInput(false)
    setPyodideLoading(true)
    setRunExecuting(true)

    const finish = (output: string, error: string | null) => {
      setRunOutput(output)
      setRunError(error)
      setPyodideLoading(false)
      setRunExecuting(false)
      setWaitingForInput(false)
    }

    let worker = workerRef.current
    if (!worker) {
      try {
        worker = new Worker(getRunWorkerUrl())
        workerRef.current = worker
      } catch (err) {
        finish("", err instanceof Error ? err.message : String(err))
        return
      }
    }

    const handleMessage = (e: MessageEvent) => {
      const data = e.data
      switch (data.type) {
        case "stdout":
          runOutputBufferRef.current += data.chunk ?? ""
          setRunOutput(runOutputBufferRef.current)
          break
        case "stdin_request":
          setWaitingForInput(true)
          break
        case "run_done":
          worker!.onmessage = null
          worker!.onerror = null
          finish(data.output ?? runOutputBufferRef.current, null)
          break
        case "run_error":
          worker!.onmessage = null
          worker!.onerror = null
          finish(data.output ?? runOutputBufferRef.current, data.message ?? "Unknown error")
          break
        default:
          break
      }
    }

    const handleError = () => {
      worker!.onmessage = null
      worker!.onerror = null
      finish(runOutputBufferRef.current, "Worker error")
    }

    worker.onmessage = handleMessage
    worker.onerror = handleError
    worker.postMessage({ type: "run", script: contents })
  }, [])

  return {
    runOutput,
    runError,
    pyodideLoading,
    runExecuting,
    runPython,
    waitingForInput,
    submitStdinLine,
  }
}
