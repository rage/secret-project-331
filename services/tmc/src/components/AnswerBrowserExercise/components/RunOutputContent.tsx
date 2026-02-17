"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { OutputPre } from "../styles"

interface RunOutputContentProps {
  pyodideLoading: boolean
  runExecuting: boolean
  runOutput: string
  runError: string | null
}

export const RunOutputContent: React.FC<RunOutputContentProps> = ({
  pyodideLoading,
  runExecuting,
  runOutput,
  runError,
}) => {
  const { t } = useTranslation()
  return (
    <OutputPre>
      {pyodideLoading && t("loading-pyodide", "Loading Pyodide...")}
      {runExecuting && !pyodideLoading && runOutput === "" && t("running", "Running...")}
      {runOutput}
      {/* eslint-disable-next-line i18next/no-literal-string -- Python runtime error */}
      {runError != null && `\n${runError}`}
    </OutputPre>
  )
}
