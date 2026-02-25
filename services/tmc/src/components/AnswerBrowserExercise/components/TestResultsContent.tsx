"use client"

import React from "react"

import { OutputPre } from "../styles"
import { formatLogsForDisplay } from "../utils"

import { TestResultCard } from "./TestResultCard"

import { RunResult } from "@/tmc/cli"

interface TestResultsContentProps {
  testResults: RunResult
}

export const TestResultsContent: React.FC<TestResultsContentProps> = ({ testResults }) => {
  if (testResults.testResults.length === 0) {
    return (
      <OutputPre>
        {testResults.status}
        {testResults.logs && Object.keys(testResults.logs).length > 0 && (
          <>
            {"\n\n"}
            {formatLogsForDisplay(testResults.logs)}
          </>
        )}
      </OutputPre>
    )
  }
  return (
    <>
      {testResults.testResults.map((tr, i) => (
        <TestResultCard
          key={i}
          name={tr.name}
          passed={tr.successful}
          message={tr.message}
          exception={tr.exception}
        />
      ))}
    </>
  )
}
