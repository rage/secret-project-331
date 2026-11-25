"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { LanguageVersionCourse } from "@/generated/api/types.generated"
import { manageCourseByIdRoute } from "@/shared-module/common/utils/routes"
import { Button, LanguageChip, Link, Table } from "@/shared-module/components"

import { ALIGN_END, RESPONSIVE_STACK } from "./constants"
import JoinCourseDialog from "./JoinCourseDialog"
import type { LanguageVersionToolMode } from "./LanguageVersionTool"
import {
  courseContentText,
  hasStudents,
  headActionsCss,
  leadCss,
  mutedCss,
  orderCourses,
  sectionCss,
  sectionHeadCss,
  studentCountText,
  useReadOnlyReason,
} from "./shared"
import SplitCourseDialog from "./SplitCourseDialog"

interface Props {
  courseId: string
  mode: LanguageVersionToolMode
  courses: LanguageVersionCourse[]
  /** Extra buttons beside the add button, e.g. creating a new language version. */
  extraActions?: React.ReactNode
  /**
   * Replaces the add dialog while the course has no other language versions, so the first course
   * is added in the flow that also links pages and exercises.
   */
  onAddFirstVersion: () => void
  /** Called after a course joined, so the tool can offer to link its pages and exercises. */
  onJoined: (joinedCourseId: string) => void
}

/** The courses of the language versions, with joining and removing courses. */
const CoursesSection: React.FC<Props> = ({
  courseId,
  mode,
  courses,
  extraActions,
  onAddFirstVersion,
  onJoined,
}) => {
  const { t } = useTranslation()
  const [isJoinOpen, setIsJoinOpen] = useState(false)
  const [splitCourseId, setSplitCourseId] = useState<string | null>(null)
  const headingId = React.useId()
  const readOnlyReason = useReadOnlyReason()

  return (
    <section className={sectionCss}>
      <div className={sectionHeadCss}>
        <h2 id={headingId}>{t("language-versions-courses-heading")}</h2>
        <div className={headActionsCss}>
          {extraActions}
          <Button
            variant="secondary"
            size="medium"
            disabledReason={readOnlyReason}
            onPress={() => (courses.length > 1 ? setIsJoinOpen(true) : onAddFirstVersion())}
          >
            {t("language-versions-add-existing-course")}
          </Button>
        </div>
      </div>
      <p className={leadCss}>
        {courses.length > 1
          ? t("language-versions-courses-lead")
          : t("language-versions-courses-lead-single")}
      </p>
      <Table
        labelledBy={headingId}
        rows={orderCourses(courses, courseId)}
        rowKey={(course) => course.id}
        responsive={RESPONSIVE_STACK}
        columns={[
          {
            header: t("language-versions-column-language"),
            cell: (course) => <LanguageChip code={course.language_code} />,
            nowrap: true,
          },
          {
            header: t("language-versions-column-course"),
            grow: true,
            cell: (course) => (
              <>
                <Link href={manageCourseByIdRoute(course.id)}>{course.name}</Link>
                {course.id === courseId && (
                  <span className={mutedCss}> {t("language-versions-this-course")}</span>
                )}
              </>
            ),
          },
          {
            header: t("language-versions-column-content"),
            cell: (course) => courseContentText(t, course),
            nowrap: true,
          },
          {
            header: t("language-versions-column-students"),
            cell: (course) => (
              <span className={hasStudents(course) ? undefined : mutedCss}>
                {studentCountText(t, course)}
              </span>
            ),
            nowrap: true,
          },
          {
            header: <span className={mutedCss}>{t("language-versions-column-actions")}</span>,
            align: ALIGN_END,
            cell: (course) =>
              course.id === courseId ? null : (
                <Button
                  variant="secondary"
                  size="small"
                  aria-label={t("language-versions-remove-course-aria", { name: course.name })}
                  disabledReason={readOnlyReason}
                  onPress={() => setSplitCourseId(course.id)}
                >
                  {t("language-versions-remove")}
                </Button>
              ),
          },
        ]}
      />
      <JoinCourseDialog
        courseId={courseId}
        mode={mode}
        courses={courses}
        open={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
        onJoined={(joinedCourseId) => {
          setIsJoinOpen(false)
          onJoined(joinedCourseId)
        }}
      />
      <SplitCourseDialog
        courseId={courseId}
        splitCourseId={splitCourseId}
        onClose={() => setSplitCourseId(null)}
      />
    </section>
  )
}

export default CoursesSection
