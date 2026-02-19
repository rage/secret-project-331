"use client"

import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { OutputPre, StdinHint, StdinInput, StdinPromptLine, StdinWaitingBanner } from "../styles"

interface RunOutputContentProps {
  pyodideLoading: boolean
  runExecuting: boolean
  runOutput: string
  runError: string | null
  waitingForInput?: boolean
  submitStdinLine?: (line: string) => void
}

/** Last non-empty line of output (e.g. Python input() prompt). */
function lastOutputLine(output: string): string {
  const lines = output.trim().split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const s = lines[i]?.trim()
    if (s !== "") {
      return lines[i] ?? ""
    }
  }
  return ""
}

export const RunOutputContent: React.FC<RunOutputContentProps> = ({
  pyodideLoading,
  runExecuting,
  runOutput,
  runError,
  waitingForInput = false,
  submitStdinLine,
}) => {
  const { t } = useTranslation()
  const [stdinValue, setStdinValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    if (submitStdinLine == null) {
      return
    }
    submitStdinLine(stdinValue)
    setStdinValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSubmit()
    }
  }

  useEffect(() => {
    if (waitingForInput && inputRef.current) {
      /* scrollIntoView options: ScrollBehavior and ScrollLogicalPosition (not user-facing) */
      // eslint-disable-next-line i18next/no-literal-string
      inputRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [waitingForInput])

  return (
    <>
      <OutputPre>
        {pyodideLoading && t("loading-pyodide", "Loading Pyodide...")}
        {runExecuting && !pyodideLoading && runOutput === "" && t("running", "Running...")}
        {runOutput}
        {/* eslint-disable-next-line i18next/no-literal-string -- Python runtime error */}
        {runError != null && `\n${runError}`}
      </OutputPre>
      {waitingForInput && submitStdinLine != null && (
        <>
          <StdinWaitingBanner role="status">
            {t("waiting-for-input", "Waiting for input")}
          </StdinWaitingBanner>
          {lastOutputLine(runOutput) && (
            <StdinPromptLine>{lastOutputLine(runOutput)}</StdinPromptLine>
          )}
          <StdinHint>{t("enter-input-press-enter", "Enter input and press Enter")}</StdinHint>
          <StdinInput
            ref={inputRef}
            type="text"
            value={stdinValue}
            onChange={(e) => setStdinValue(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={t("program-input", "Program input")}
          />
        </>
      )}
    </>
  )
}
