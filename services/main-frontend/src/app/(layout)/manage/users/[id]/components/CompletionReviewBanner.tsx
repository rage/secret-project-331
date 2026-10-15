"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { TONE } from "@/components/credit-registration/constants"
import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { Infobox, Link } from "@/shared-module/components"

import { awaitingReviewCount } from "../lib/completions"

export interface CompletionReviewBannerProps {
  enrollments: CourseEnrollmentInfo[]
  /** Fragment id of the completion-review section to jump to. */
  targetId: string
}

/**
 * The page's only alert for completions awaiting cheating review; links to the review section.
 *
 * The stat tiles deliberately do not repeat this count: two alerts for one number read as two
 * problems.
 */
const CompletionReviewBanner: React.FC<CompletionReviewBannerProps> = ({
  enrollments,
  targetId,
}) => {
  const { t } = useTranslation()
  const awaitingReview = awaitingReviewCount(enrollments)

  if (awaitingReview === 0) {
    return null
  }

  return (
    <Infobox tone={TONE.DANGER}>
      <p>{t("completions-awaiting-review", { count: awaitingReview })}</p>
      <Link href={`#${targetId}`}>{t("completion-review")}</Link>
    </Infobox>
  )
}

export default CompletionReviewBanner
