"use client"

import { useParams } from "next/navigation"
import React from "react"

import ExamPageShell from "../../ExamPageShell"

import TestExamTeacherTools from "./TestExamTeacherTools"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const Exam: React.FC = () => {
  const params = useParams<{ organizationSlug: string; id: string }>()
  const examId = params.id
  const organizationSlug = params.organizationSlug

  return (
    <ExamPageShell
      // eslint-disable-next-line i18next/no-literal-string
      mode="testexam"
      examId={examId}
      organizationSlug={organizationSlug}
      renderAfterPage={({ examId: id, examData }) => (
        <TestExamTeacherTools examId={id} examData={examData} />
      )}
    />
  )
}

export default withErrorBoundary(withSignedIn(Exam))
