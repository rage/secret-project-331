"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { useUserCourseProgress } from "@/hooks/useUserCourseProgress"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

export function CourseProgressSection({ courseId, userId }: { courseId: string; userId: string }) {
  const { t } = useTranslation()
  const progressQuery = useUserCourseProgress(courseId, userId)

  if (progressQuery.isLoading) {
    return <Spinner variant="small" />
  }

  if (progressQuery.isError) {
    return <ErrorBanner error={progressQuery.error} />
  }

  if (!progressQuery.data || progressQuery.data.length === 0) {
    return null
  }

  return (
    <div
      className={css`
        margin-top: 0.5rem;
        padding-top: 1rem;
        border-top: 2px solid ${baseTheme.colors.clear[300]};
      `}
    >
      <h4
        className={css`
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: ${baseTheme.colors.gray[500]};
          margin: 0 0 0.75rem 0;
        `}
      >
        {t("label-course-progress")}
      </h4>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        `}
      >
        {progressQuery.data.map((mod) => (
          <div
            key={mod.course_module_id}
            className={css`
              padding: 0.5rem;
              background: ${baseTheme.colors.clear[100]};
              border-radius: 6px;
              font-size: 0.85rem;
            `}
          >
            <div
              className={css`
                font-weight: 600;
                color: ${baseTheme.colors.gray[700]};
                margin-bottom: 0.25rem;
              `}
            >
              {mod.course_module_name}
            </div>
            <div
              className={css`
                color: ${baseTheme.colors.gray[600]};
              `}
            >
              {mod.score_maximum != null
                ? `${mod.score_given} / ${mod.score_maximum} ${t("label-points")}`
                : `${mod.score_given} ${t("label-points")}`}
              {mod.total_exercises != null && mod.attempted_exercises != null && (
                <>
                  {/* eslint-disable-next-line i18next/no-literal-string -- typographic separator */}
                  {" · "}
                  {mod.attempted_exercises} / {mod.total_exercises} {t("label-exercises")}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
