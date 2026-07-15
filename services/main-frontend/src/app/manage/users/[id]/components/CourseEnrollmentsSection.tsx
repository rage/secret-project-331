"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseEnrollmentCard from "./CourseEnrollmentCard"

import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

export interface CourseEnrollmentsSectionProps {
  enrollments: CourseEnrollmentInfo[]
  userId: string
}

const listCss = css`
  display: grid;
  gap: 0.75rem;
`

const emptyCss = css`
  color: ${baseTheme.colors.gray[500]};
`

const byMostRecentlyEnrolled = (a: CourseEnrollmentInfo, b: CourseEnrollmentInfo) =>
  new Date(b.first_enrolled_at).getTime() - new Date(a.first_enrolled_at).getTime()

/** All course enrollments as a single list, most recently enrolled first; each an expandable card. */
const CourseEnrollmentsSection: React.FC<CourseEnrollmentsSectionProps> = ({
  enrollments,
  userId,
}) => {
  const { t } = useTranslation()

  if (enrollments.length === 0) {
    return <p className={emptyCss}>{t("no-course-enrollments")}</p>
  }

  const sorted = enrollments.toSorted(byMostRecentlyEnrolled)

  return (
    <div className={listCss}>
      {sorted.map((enrollment) => (
        <CourseEnrollmentCard key={enrollment.course_id} enrollment={enrollment} userId={userId} />
      ))}
    </div>
  )
}

export default CourseEnrollmentsSection
