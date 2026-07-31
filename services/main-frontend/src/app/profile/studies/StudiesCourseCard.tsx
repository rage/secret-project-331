"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { MyStudiesCourse } from "@/generated/api/types.generated"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"
import { navigateToCourseRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import { Badge, Disclosure, Link } from "@/shared-module/components"

import { MIDDLE_DOT, TONE } from "../constants"
import CourseCompletionsTable from "./CourseCompletionsTable"
import CourseProgressSection from "./CourseProgressSection"

export interface StudiesCourseCardProps {
  course: MyStudiesCourse
}

const cardCss = css`
  margin-bottom: 0.75rem;
`

const summaryCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 0.75rem;
`

const courseNameCss = css`
  font-weight: ${fontWeights.semibold};
  font-size: 1.05rem;
  color: ${baseTheme.colors.gray[700]};
`

const metaCss = css`
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.9rem;
`

const sectionHeadingCss = css`
  font-size: 1rem;
  font-weight: ${fontWeights.semibold};
  color: ${baseTheme.colors.gray[600]};
  margin: 1.25rem 0 0.5rem;
`

const linkRowCss = css`
  margin: 1rem 0 0.25rem;
`

const StudiesCourseCard: React.FC<StudiesCourseCardProps> = ({ course }) => {
  const { t, i18n } = useTranslation()

  // A failed module still has a completion, so filter on `passed` or the badge claims a pass.
  const completedModules = course.modules.filter((m) => m.completion?.passed).length
  const title = (
    <span className={summaryCss}>
      <span className={courseNameCss}>{course.course_name}</span>
      <span className={metaCss}>
        {ietfLanguageTagToHumanReadableName(course.language_code, i18n.language)}
        {MIDDLE_DOT}
        {t("enrolled-on-date", { date: dateToString(course.first_enrolled_at, false) })}
      </span>
      <Badge tone={completedModules > 0 ? TONE.SUCCESS : TONE.NEUTRAL}>
        {t("modules-completed-of-total", {
          completed: completedModules,
          total: course.modules.length,
        })}
      </Badge>
      {course.is_current ? null : (
        <Badge tone={TONE.NEUTRAL}>{t("badge-not-current-version")}</Badge>
      )}
    </span>
  )

  return (
    <div className={cardCss} data-testid="profile-course-card">
      <Disclosure title={title}>
        {course.current_course_instance_id ? (
          <>
            <h3 className={sectionHeadingCss}>{t("heading-your-progress")}</h3>
            <CourseProgressSection courseInstanceId={course.current_course_instance_id} />
          </>
        ) : null}
        <h3 className={sectionHeadingCss}>{t("heading-completions")}</h3>
        <CourseCompletionsTable course={course} />
        <div className={linkRowCss}>
          <Link
            href={navigateToCourseRoute(course.organization_slug, course.course_slug)}
            styledAsButton
            variant="secondary"
            size="small"
          >
            {t("go-to-course")}
          </Link>
        </div>
      </Disclosure>
    </div>
  )
}

export default StudiesCourseCard
