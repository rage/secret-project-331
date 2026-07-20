"use client"

import { css } from "@emotion/css"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

import { awaitingReviewCount } from "../lib/completions"

export interface CompletionReviewBannerProps {
  enrollments: CourseEnrollmentInfo[]
  /** Fragment id of the completion-review section to jump to. */
  targetId: string
}

const bannerCss = css`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 1.5rem 0;
  padding: 0.9rem 1.2rem;
  border-radius: 6px;
  text-decoration: none;
  background: ${baseTheme.colors.red[100]};
  border: 1px solid ${baseTheme.colors.red[300]};
  color: ${baseTheme.colors.red[800]};
  font-weight: 500;

  &:hover {
    background: ${baseTheme.colors.red[200]};
  }
`

/**
 * Alert shown when the student has completions awaiting review; links to the completion-review section.
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
    <a className={bannerCss} href={`#${targetId}`}>
      <ExclamationTriangle size={18} weight="bold" aria-hidden="true" />
      <span>{t("completions-awaiting-review", { count: awaitingReview })}</span>
    </a>
  )
}

export default CompletionReviewBanner
