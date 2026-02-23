"use client"

import { useParams } from "next/navigation"
import React from "react"

import ExamPageShell from "../ExamPageShell"

import EndExamButton from "./EndExamButton"
import ExamGradingView from "./ExamGradingView"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const Exam: React.FC = () => {
  const params = useParams<{ organizationSlug: string; id: string }>()
  const examId = params.id
  const organizationSlug = params.organizationSlug

  return (
    <ExamPageShell
      // eslint-disable-next-line i18next/no-literal-string
      mode="exam"
      examId={examId}
      organizationSlug={organizationSlug}
      showEndedInfo
      renderGradingView={(examData) => <ExamGradingView examData={examData} />}
      renderFooterActions={({ examId: id, examData, onRefresh }) => (
        <EndExamButton examId={id} disabled={examData.ended} onEnded={onRefresh} />
      )}
    />
  )
}

export default withErrorBoundary(withSignedIn(Exam))
