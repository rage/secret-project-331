"use client"

import { css } from "@emotion/css"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import createFlaggedSuspectedCheaterCountHook from "@/hooks/count/useFlaggedSuspectedCheaterCount"
import { baseTheme } from "@/shared-module/common/styles"
import { manageCourseOtherCheatersSuspectedRoute } from "@/shared-module/common/utils/routes"

interface SuspectedCheatersReviewBannerProps {
  courseId: string
}

/**
 * Shown on the course overview page when the course has suspected cheaters still awaiting
 * review (status flagged), linking the teacher to the suspected cheaters page.
 */
const SuspectedCheatersReviewBanner: React.FC<SuspectedCheatersReviewBannerProps> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const useFlaggedSuspectedCheaterCount = createFlaggedSuspectedCheaterCountHook(courseId)
  const flaggedCount = useFlaggedSuspectedCheaterCount()

  if (!flaggedCount.isSuccess || flaggedCount.data === 0) {
    return null
  }

  return (
    <Link
      href={manageCourseOtherCheatersSuspectedRoute(courseId)}
      className={css`
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 1.5rem;
        padding: 0.9rem 1.2rem;
        border-radius: 6px;
        text-decoration: none;
        background: ${baseTheme.colors.red[100]};
        border: 1px solid ${baseTheme.colors.red[300]};
        color: ${baseTheme.colors.red[700]};
        font-weight: 500;

        &:hover {
          background: ${baseTheme.colors.red[200]};
        }
      `}
    >
      <ExclamationTriangle size={18} weight="bold" aria-hidden="true" />
      <span>{t("suspected-cheaters-awaiting-review", { count: flaggedCount.data })}</span>
    </Link>
  )
}

export default SuspectedCheatersReviewBanner
