"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { dividedListCss, emptyStateCss } from "@/components/credit-registration/styles"
import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"

import CourseEnrollmentCard from "./CourseEnrollmentCard"

export interface CourseEnrollmentsSectionProps {
  enrollments: CourseEnrollmentInfo[]
  userId: string
}

const byMostRecentlyEnrolled = (a: CourseEnrollmentInfo, b: CourseEnrollmentInfo) =>
  new Date(b.first_enrolled_at).getTime() - new Date(a.first_enrolled_at).getTime()

/** All course enrollments as a single list, most recently enrolled first; each an expandable card. */
const CourseEnrollmentsSection: React.FC<CourseEnrollmentsSectionProps> = ({
  enrollments,
  userId,
}) => {
  const { t } = useTranslation()

  if (enrollments.length === 0) {
    return <p className={emptyStateCss}>{t("no-course-enrollments")}</p>
  }

  const sorted = enrollments.toSorted(byMostRecentlyEnrolled)

  return (
    <ul className={dividedListCss}>
      {sorted.map((enrollment) => (
        <li key={enrollment.course_id}>
          <CourseEnrollmentCard enrollment={enrollment} userId={userId} />
        </li>
      ))}
    </ul>
  )
}

export default CourseEnrollmentsSection
