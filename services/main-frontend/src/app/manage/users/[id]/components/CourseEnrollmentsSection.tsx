"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseEnrollmentCard from "./CourseEnrollmentCard"

import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"

export interface CourseEnrollmentsSectionProps {
  enrollments: CourseEnrollmentInfo[]
  userId: string
}

const groupHeadingCss = css`
  margin: 1.5rem 0 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-gray-500, #535a66);
`

const listCss = css`
  display: grid;
  gap: 0.75rem;
`

const emptyCss = css`
  color: var(--color-gray-500, #535a66);
`

const byMostRecentlyEnrolled = (a: CourseEnrollmentInfo, b: CourseEnrollmentInfo) =>
  new Date(b.first_enrolled_at).getTime() - new Date(a.first_enrolled_at).getTime()

/** Course enrollments grouped into current and past, each course an expandable card. */
const CourseEnrollmentsSection: React.FC<CourseEnrollmentsSectionProps> = ({
  enrollments,
  userId,
}) => {
  const { t } = useTranslation()

  if (enrollments.length === 0) {
    return <p className={emptyCss}>{t("no-course-enrollments")}</p>
  }

  const current = enrollments.filter((e) => e.is_current).sort(byMostRecentlyEnrolled)
  const past = enrollments.filter((e) => !e.is_current).sort(byMostRecentlyEnrolled)

  const renderGroup = (heading: string, items: CourseEnrollmentInfo[]) =>
    items.length > 0 ? (
      <>
        <h3 className={groupHeadingCss}>
          {heading} ({items.length})
        </h3>
        <div className={listCss}>
          {items.map((enrollment) => (
            <CourseEnrollmentCard
              key={enrollment.course_id}
              enrollment={enrollment}
              userId={userId}
            />
          ))}
        </div>
      </>
    ) : null

  return (
    <div>
      {renderGroup(t("current-courses"), current)}
      {renderGroup(t("past-courses"), past)}
    </div>
  )
}

export default CourseEnrollmentsSection
