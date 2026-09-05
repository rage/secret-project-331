"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { Badge, TONE } from "@/shared-module/components"

const CourseModuleCompletionNeedsReviewBadge: React.FC = () => {
  const { t } = useTranslation()

  return (
    <Badge tone={TONE.WARNING} title={t("course-module-completion-needs-review")}>
      {t("course-module-completion-needs-review-short")}
    </Badge>
  )
}

export default CourseModuleCompletionNeedsReviewBadge
