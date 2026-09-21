"use client"

import { css } from "@emotion/css"
import React, { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { BUTTON_SECONDARY } from "@/components/credit-registration/constants"
import { controlCss, controlsCss, emptyStateCss } from "@/components/credit-registration/styles"
import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import { Button, TextField } from "@/shared-module/components"

import type { UserCreditRegistrations } from "../lib/creditRegistrations"
import { courseSpan } from "../lib/violinDensity"
import CourseEnrollmentCard from "./CourseEnrollmentCard"

export interface CourseEnrollmentsSectionProps {
  enrollments: CourseEnrollmentInfo[]
  userId: string
  registrations: UserCreditRegistrations
}

/** Query parameter a course roster links here with, naming the course to land on. */
const COURSE_PARAM = "course"

/** Below this many rows the list is short enough to read, and a filter is one control too many. */
const FILTER_FROM_ROWS = 10

const BUTTON_SMALL = "small" as const

// Each card is already a bordered Disclosure; a divider between them as well would draw two lines
// at every seam.
const cardListCss = css`
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
`

interface FilterFields {
  courseName: string
}

/**
 * Courses the student worked in first, then by last activity — enrolment order says nothing when a
 * batch of enrolments was created at one instant, which is how bulk-enrolled accounts look.
 */
const byWorkThenActivity = (enrollments: CourseEnrollmentInfo[]): CourseEnrollmentInfo[] =>
  enrollments
    .map((enrollment) => ({ enrollment, lastActivityMs: courseSpan(enrollment).lastActivityMs }))
    .toSorted((a, b) => {
      const aWorked = a.enrollment.course_module_completions.length > 0
      const bWorked = b.enrollment.course_module_completions.length > 0
      if (aWorked !== bWorked) {
        return aWorked ? -1 : 1
      }
      return b.lastActivityMs - a.lastActivityMs
    })
    .map((row) => row.enrollment)

/** Every course enrolment as an expandable card, scannable without opening any of them. */
const CourseEnrollmentsSection: React.FC<CourseEnrollmentsSectionProps> = ({
  enrollments,
  userId,
  registrations,
}) => {
  const { t } = useTranslation()
  const { control, watch } = useForm<FilterFields>({ defaultValues: { courseName: "" } })
  const courseName = watch("courseName")
  const [expandedCourseIds, setExpandedCourseIds] = useState<ReadonlySet<string>>(new Set())

  // A teacher arriving from one course's roster wants that course open; a student with a single
  // enrolment has nothing to scan, so opening it saves everyone a click.
  const requestedCourseId = useQueryParameter(COURSE_PARAM)
  const landOnCourseId =
    enrollments.length === 1 ? (enrollments[0]?.course_id ?? null) : requestedCourseId || null
  useEffect(() => {
    if (landOnCourseId !== null) {
      setExpandedCourseIds((current) => new Set(current).add(landOnCourseId))
    }
  }, [landOnCourseId])

  const sorted = useMemo(() => byWorkThenActivity(enrollments), [enrollments])
  const needle = courseName.trim().toLowerCase()
  const visible = needle
    ? sorted.filter((enrollment) => enrollment.course.name.toLowerCase().includes(needle))
    : sorted

  if (enrollments.length === 0) {
    return <p className={emptyStateCss}>{t("no-course-enrollments")}</p>
  }

  const setExpanded = (courseId: string, expanded: boolean) =>
    setExpandedCourseIds((current) => {
      const next = new Set(current)
      if (expanded) {
        next.add(courseId)
      } else {
        next.delete(courseId)
      }
      return next
    })

  return (
    <>
      {enrollments.length > 1 && (
        <div className={controlsCss}>
          {enrollments.length >= FILTER_FROM_ROWS && (
            <div className={controlCss}>
              <TextField
                name="courseName"
                control={control}
                label={t("label-filter-by-course-name")}
              />
            </div>
          )}
          <Button
            variant={BUTTON_SECONDARY}
            size={BUTTON_SMALL}
            onClick={() => setExpandedCourseIds(new Set(visible.map((e) => e.course_id)))}
          >
            {t("expand-all")}
          </Button>
          <Button
            variant={BUTTON_SECONDARY}
            size={BUTTON_SMALL}
            onClick={() => setExpandedCourseIds(new Set())}
          >
            {t("collapse-all")}
          </Button>
        </div>
      )}
      {visible.length === 0 ? (
        <p className={emptyStateCss}>{t("no-courses-match-the-filter")}</p>
      ) : (
        <ul className={cardListCss}>
          {visible.map((enrollment) => (
            <li key={enrollment.course_id}>
              <CourseEnrollmentCard
                enrollment={enrollment}
                userId={userId}
                registrations={registrations}
                expanded={expandedCourseIds.has(enrollment.course_id)}
                onExpandedChange={(expanded) => setExpanded(enrollment.course_id, expanded)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default CourseEnrollmentsSection
