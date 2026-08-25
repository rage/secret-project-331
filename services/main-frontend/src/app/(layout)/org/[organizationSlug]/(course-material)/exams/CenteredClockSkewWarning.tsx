"use client"

import Centered from "@/shared-module/common/components/Centering/Centered"

import ExamClockSkewWarning from "./ExamClockSkewWarning"

/** Renders ExamClockSkewWarning centered to avoid layout regressions. */
export default function CenteredClockSkewWarning() {
  return (
    <Centered variant="default">
      <ExamClockSkewWarning />
    </Centered>
  )
}
