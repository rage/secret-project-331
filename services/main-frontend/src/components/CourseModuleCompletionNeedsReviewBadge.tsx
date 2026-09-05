"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/shared-module/components"

const NEEDS_REVIEW_TONE = "warning" as const

const CourseModuleCompletionNeedsReviewBadge: React.FC = () => {
  const { t } = useTranslation()

  return (
    <Badge tone={NEEDS_REVIEW_TONE} title={t("course-module-completion-needs-review")}>
      {t("course-module-completion-needs-review-short")}
    </Badge>
  )
}

export default CourseModuleCompletionNeedsReviewBadge
