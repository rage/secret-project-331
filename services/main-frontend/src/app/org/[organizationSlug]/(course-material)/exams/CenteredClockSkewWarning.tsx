"use client"

import ExamClockSkewWarning from "./ExamClockSkewWarning"

import Centered from "@/shared-module/common/components/Centering/Centered"

/** Renders ExamClockSkewWarning centered to avoid layout regressions. */
export default function CenteredClockSkewWarning() {
  return (
    <Centered variant="default">
      <ExamClockSkewWarning />
    </Centered>
  )
}
