"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import type {
  CourseDesignerCourseStatus,
  CourseDesignerUnfilledPageReason,
} from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { editPageRoute, manageCourseRoute } from "@/shared-module/common/utils/routes"
import { Badge, Link, TONE } from "@/shared-module/components"

const cardStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.gray[50]};
`

const headerStyles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
`

const headingStyles = css`
  font-size: 1.05rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0;
`

const summaryStyles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[700]};
`

const subheadingStyles = css`
  font-size: 0.9rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[800]};
  margin: 0 0 0.25rem;
`

const itemListStyles = css`
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[700]};

  li {
    padding: 0.15rem 0;
  }
`

const mutedStyles = css`
  margin: 0;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
`

const REASON_KEYS = {
  empty: "course-plans-course-status-reason-empty",
  placeholder_text: "course-plans-course-status-reason-placeholder-text",
  ai_outline: "course-plans-course-status-reason-ai-outline",
} as const satisfies Record<CourseDesignerUnfilledPageReason, string>

/** The plan's course at a glance: draft state, size, pages that still need writing and chapters without exercises. */
export default function CourseStatusCard(props: { status: CourseDesignerCourseStatus }) {
  const { status } = props
  const { t } = useTranslation()
  return (
    <section className={cardStyles} aria-labelledby="course-status-heading">
      <div className={headerStyles}>
        <h4 className={headingStyles} id="course-status-heading">
          {t("course-plans-course-status-heading")}
        </h4>
        <Link href={manageCourseRoute(status.course_id)}>
          {t("course-plans-course-status-manage-course", { name: status.name })}
        </Link>
      </div>
      <ul className={summaryStyles}>
        <li>
          <Badge tone={status.is_draft ? TONE.WARNING : TONE.SUCCESS} size="compact">
            {status.is_draft
              ? t("course-plans-course-status-draft")
              : t("course-plans-course-status-published")}
          </Badge>
        </li>
        <li>{t("course-plans-course-status-chapter-count", { count: status.chapter_count })}</li>
        <li>{t("course-plans-course-status-page-count", { count: status.page_count })}</li>
      </ul>
      <div>
        <h5 className={subheadingStyles}>{t("course-plans-course-status-unfilled-heading")}</h5>
        {status.unfilled_pages.length === 0 ? (
          <p className={mutedStyles}>{t("course-plans-course-status-no-unfilled")}</p>
        ) : (
          <ul className={itemListStyles}>
            {status.unfilled_pages.map((page) => (
              <li key={page.page_id}>
                <Link href={editPageRoute(page.page_id)}>{page.title}</Link>{" "}
                {t("course-plans-course-status-page-reason", {
                  reason: t(REASON_KEYS[page.reason]),
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h5 className={subheadingStyles}>{t("course-plans-course-status-no-exercises-heading")}</h5>
        {status.chapter_count === 0 ? (
          <p className={mutedStyles}>{t("course-plans-course-status-no-chapters")}</p>
        ) : status.chapters_without_exercises.length === 0 ? (
          <p className={mutedStyles}>{t("course-plans-course-status-all-have-exercises")}</p>
        ) : (
          <ul className={itemListStyles}>
            {status.chapters_without_exercises.map((chapter) => (
              <li key={chapter.chapter_id}>
                {t("course-plans-course-status-chapter-name", {
                  number: chapter.chapter_number,
                  name: chapter.name,
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
