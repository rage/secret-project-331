"use client"

import { useRef, useState } from "react"

import { getPyodide } from "@/util/pyodideLoader"

export function useRunOutput() {
  const [runOutput, setRunOutput] = useState("")
  const [runError, setRunError] = useState<string | null>(null)
  const [pyodideLoading, setPyodideLoading] = useState(false)
  const [runExecuting, setRunExecuting] = useState(false)
  const runOutputBufferRef = useRef("")

  const runPython = async (contents: string) => {
    setRunError(null)
    runOutputBufferRef.current = ""
    setRunOutput("")
    setPyodideLoading(true)
    setRunExecuting(true)
    try {
      const pyodide = await getPyodide()
      setPyodideLoading(false)
      const appendByte = (byte: number) => {
        runOutputBufferRef.current += String.fromCharCode(byte)
        setRunOutput(runOutputBufferRef.current)
      }
      pyodide.setStdout({ raw: appendByte })
      pyodide.setStderr({ raw: appendByte })
      await pyodide.runPythonAsync(contents)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunExecuting(false)
    }
  }

  return { runOutput, runError, pyodideLoading, runExecuting, runPython }
}
