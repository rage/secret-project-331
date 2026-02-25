"use client"

import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import type { OutputSegment } from "../hooks/useRunOutput"
import {
  OutputPre,
  StdinHint,
  StdinInput,
  StdinLineRow,
  StdinPromptLine,
  StdinSubmittedLine,
  StdinWaitingBanner,
} from "../styles"

interface RunOutputContentProps {
  pyodideLoading: boolean
  runExecuting: boolean
  runOutput: string
  runError: string | null
  waitingForInput?: boolean
  /** Prompt string from input() when waiting for input (e.g. "Give x: ") */
  stdinPrompt?: string
  /** Ordered stdout + input segments (so input prompt + submitted line stay visible after run) */
  segments?: OutputSegment[]
  submitStdinLine?: (line: string) => void
}

/** Merge consecutive stdout segments into one for a single pre block */
function mergeStdoutSegments(
  segments: OutputSegment[],
): Array<{ type: "stdout"; text: string } | OutputSegment> {
  const result: Array<{ type: "stdout"; text: string } | OutputSegment> = []
  let stdoutAcc = ""
  for (const seg of segments) {
    if (seg.type === "stdout") {
      stdoutAcc += seg.text
    } else {
      if (stdoutAcc) {
        result.push({ type: "stdout", text: stdoutAcc })
        stdoutAcc = ""
      }
      result.push(seg)
    }
  }
  if (stdoutAcc) {
    result.push({ type: "stdout", text: stdoutAcc })
  }
  return result
}

export const RunOutputContent: React.FC<RunOutputContentProps> = ({
  pyodideLoading,
  runExecuting,
  runOutput,
  runError,
  waitingForInput = false,
  stdinPrompt = "",
  segments = [],
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

  const blocks = mergeStdoutSegments(segments)
  const lastSegment = segments[segments.length - 1]
  const lastIsInputWaiting =
    lastSegment?.type === "input" && lastSegment.line === "" && waitingForInput

  return (
    <>
      {pyodideLoading && <OutputPre>{t("loading-pyodide", "Loading Pyodide...")}</OutputPre>}
      {runExecuting && !pyodideLoading && segments.length === 0 && (
        <OutputPre>{t("running", "Running...")}</OutputPre>
      )}
      {blocks.map((block, index) => {
        if (block.type === "stdout") {
          return <OutputPre key={`stdout-${index}`}>{block.text}</OutputPre>
        }
        const isLastWaiting = lastIsInputWaiting && index === blocks.length - 1
        return (
          <React.Fragment key={`input-${index}`}>
            {block.line !== "" ? (
              <StdinLineRow>
                {block.prompt != null && block.prompt !== "" && (
                  <StdinPromptLine>{block.prompt}</StdinPromptLine>
                )}
                <StdinSubmittedLine>{block.line}</StdinSubmittedLine>
              </StdinLineRow>
            ) : (
              <>
                {block.prompt != null && block.prompt !== "" && (
                  <StdinLineRow>
                    <StdinPromptLine>{block.prompt}</StdinPromptLine>
                  </StdinLineRow>
                )}
                {isLastWaiting && submitStdinLine != null ? (
                  <>
                    <StdinWaitingBanner role="status">
                      {t("waiting-for-input", "Waiting for input")}
                    </StdinWaitingBanner>
                    <StdinHint>
                      {t("enter-input-press-enter", "Enter input and press Enter")}
                    </StdinHint>
                    <StdinInput
                      ref={inputRef}
                      type="text"
                      value={stdinValue}
                      onChange={(e) => setStdinValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      aria-label={t("program-input", "Program input")}
                    />
                  </>
                ) : null}
              </>
            )}
          </React.Fragment>
        )
      })}
      {/* Show current waiting UI when no segment is last-waiting (e.g. very first stdin_request before any stdout) */}
      {waitingForInput && submitStdinLine != null && !lastIsInputWaiting && (
        <>
          <StdinWaitingBanner role="status">
            {t("waiting-for-input", "Waiting for input")}
          </StdinWaitingBanner>
          {stdinPrompt && <StdinPromptLine>{stdinPrompt}</StdinPromptLine>}
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
      {runError != null && <OutputPre>{runError}</OutputPre>}
    </>
  )
}
