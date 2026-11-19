"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { ExerciseChangeWarning } from "@/generated/api/types.generated"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"

interface ExerciseWarningListProps {
  warnings: ExerciseChangeWarning[]
}

/** What to know before publishing a page's exercise changes; unlike risks, these don't need a confirmation. */
const ExerciseWarningList: React.FC<ExerciseWarningListProps> = ({ warnings }) => {
  const { t } = useTranslation()
  return (
    <section
      data-testid="agent-exercise-warnings"
      aria-labelledby="agent-exercise-warnings-heading"
      className={css`
        border: 1px solid ${baseTheme.colors.gray[300]};
        border-radius: 8px;
        padding: 0.75rem 1rem;
        background: ${baseTheme.colors.clear[100]};
      `}
    >
      <h4
        id="agent-exercise-warnings-heading"
        className={css`
          font-size: 1rem;
          font-weight: ${fontWeights.semibold};
          color: ${baseTheme.colors.gray[700]};
          margin: 0 0 0.5rem 0;
        `}
      >
        {t("agent-warning-heading")}
      </h4>
      <ul
        className={css`
          margin: 0;
          padding-left: 1.25rem;
        `}
      >
        {warnings.map((warning) => (
          <li key={`${warning.kind}-${warning.exercise_id}`}>
            {t(
              warning.to === "course_default"
                ? "agent-warning-review-config-to-course-default"
                : "agent-warning-review-config-to-own",
              { exercise: warning.exercise_name, count: warning.review_count },
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default ExerciseWarningList
