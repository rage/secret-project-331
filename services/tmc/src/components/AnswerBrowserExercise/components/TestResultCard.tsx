"use client"

import React from "react"

import { TestResultCard as StyledCard, TestResultHeader, TestResultMessage } from "../styles"

interface TestResultCardProps {
  name: string
  passed: boolean
  message?: string
  exception?: Array<string>
}

export const TestResultCard: React.FC<TestResultCardProps> = (p) => (
  <StyledCard passed={p.passed} data-cy="test-result">
    <TestResultHeader passed={p.passed}>
      {p.passed ? "PASS" : "FAIL"}: {p.name}
    </TestResultHeader>
    {(p.message || (p.exception && p.exception.length > 0)) && (
      <TestResultMessage>
        {p.message}
        {/* eslint-disable-next-line i18next/no-literal-string -- raw test exception output */}
        {p.exception && p.exception.length > 0 ? `\n${p.exception.join("\n")}` : ""}
      </TestResultMessage>
    )}
  </StyledCard>
)
