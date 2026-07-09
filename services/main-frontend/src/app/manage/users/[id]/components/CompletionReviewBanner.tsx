"use client"

import { css } from "@emotion/css"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { awaitingReviewCount } from "../lib/completions"

import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"

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
  background: var(--color-red-100, #f0e1dd);
  border: 1px solid var(--color-red-300, #d3a49a);
  color: var(--color-red-800, #823425);
  font-weight: 500;

  &:hover {
    background: var(--color-red-200, #e2c2bc);
  }
`

/**
 * A prominent, hard-to-miss alert shown when the student has completions still awaiting cheating
 * review (hidden from them until a teacher decides). Links down to the completion-review section.
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
