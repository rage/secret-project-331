"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

interface CourseModuleCompletionNeedsReviewBadgeProps {
  className?: string
}

const badgeClass = css`
  align-items: center;
  background: ${baseTheme.colors.red[100]};
  border: 1px solid ${baseTheme.colors.red[500]};
  border-radius: 0.25rem;
  color: ${baseTheme.colors.red[800]};
  display: inline-flex;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  padding: 0.125rem 0.375rem;
  white-space: nowrap;
`

const CourseModuleCompletionNeedsReviewBadge: React.FC<
  CourseModuleCompletionNeedsReviewBadgeProps
> = ({ className }) => {
  const { t } = useTranslation()

  return (
    <span className={cx(badgeClass, className)} title={t("course-module-completion-needs-review")}>
      {t("course-module-completion-needs-review-short")}
    </span>
  )
}

export default CourseModuleCompletionNeedsReviewBadge
