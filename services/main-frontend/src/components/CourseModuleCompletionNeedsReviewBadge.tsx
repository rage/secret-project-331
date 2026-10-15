"use client"

import { Flag } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { BADGE_COMPACT, TONE } from "@/components/credit-registration/constants"
import { Badge } from "@/shared-module/components"

const ICON_SIZE = 12

/**
 * A completion held back for a cheating review.
 *
 * Deliberately not the warning tone the registration badges use: the two are unrelated states in
 * adjacent roster columns, and one yellow should mean one thing.
 */
const CourseModuleCompletionNeedsReviewBadge: React.FC = () => {
  const { t } = useTranslation()

  return (
    <Badge
      tone={TONE.INFO}
      size={BADGE_COMPACT}
      icon={<Flag size={ICON_SIZE} />}
      title={t("course-module-completion-needs-review")}
    >
      {t("course-module-completion-needs-review-short")}
    </Badge>
  )
}

export default CourseModuleCompletionNeedsReviewBadge
