"use client"

import { useCallback, useMemo, useRef, useState } from "react"

function getRunWorkerUrl(): string {
  const base = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BASE_PATH
  return `${base ?? ""}/runWorker.js`
}

export type OutputSegment =
  | { type: "stdout"; text: string }
  | { type: "input"; prompt: string; line: string }

export function useRunOutput() {
  const [segments, setSegments] = useState<OutputSegment[]>([])
  const [runError, setRunError] = useState<string | null>(null)
  const [pyodideLoading, setPyodideLoading] = useState(false)
  const [runExecuting, setRunExecuting] = useState(false)
  const [waitingForInput, setWaitingForInput] = useState(false)
  const [stdinPrompt, setStdinPrompt] = useState("")
  const workerRef = useRef<Worker | null>(null)
  const runOutputBufferRef = useRef("")

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
        if (seg.type === "input" && seg.line === "") {
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
    workerRef.current?.postMessage({ type: "stdin_line", line })
  }, [])

  const runPython = useCallback(async (contents: string) => {
    setRunError(null)
    runOutputBufferRef.current = ""
    setSegments([])
    setWaitingForInput(false)
    setStdinPrompt("")
    setPyodideLoading(true)
    setRunExecuting(true)

    const finish = (_output: string, error: string | null) => {
      setRunError(error)
      setPyodideLoading(false)
      setRunExecuting(false)
      setWaitingForInput(false)
      setStdinPrompt("")
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
        case "stdout": {
          const chunk = data.chunk ?? ""
          runOutputBufferRef.current += chunk
          setSegments((prev) => {
            const last = prev[prev.length - 1]
            if (last?.type === "stdout") {
              return [...prev.slice(0, -1), { type: "stdout", text: last.text + chunk }]
            }
            return [...prev, { type: "stdout", text: chunk }]
          })
          break
        }
        case "stdin_request":
          setSegments((prev) => [...prev, { type: "input", prompt: data.prompt ?? "", line: "" }])
          setStdinPrompt(data.prompt ?? "")
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

  const stopRun = useCallback(() => {
    const worker = workerRef.current
    if (!worker) {
      return
    }
    worker.onmessage = null
    worker.onerror = null
    setPyodideLoading(false)
    setRunExecuting(false)
    setWaitingForInput(false)
    setStdinPrompt("")
    worker.terminate()
    workerRef.current = null
  }, [])

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
