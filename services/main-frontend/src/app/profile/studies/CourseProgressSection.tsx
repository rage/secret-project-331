"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseModuleProgressBars from "@/components/course-material/ContentRenderer/moocfi/CourseProgressBlock/CourseModuleProgressBars"
import { getCourseMaterialUserCourseProgressOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

export interface CourseProgressSectionProps {
  courseInstanceId: string
}

const moduleNameCss = css`
  font-size: 1rem;
  font-weight: ${fontWeights.semibold};
  color: ${baseTheme.colors.gray[700]};
  margin: 1rem 0 0.25rem;
`

/**
 * Per-module points and exercise progress for one course instance. Mounted only while its course's
 * accordion is open, which is what keeps a student with a dozen courses from paying a dozen requests
 * on first paint. Has its own QueryResult and error boundary so a failure here cannot blank the
 * completion record next to it.
 */
const CourseProgressSection: React.FC<CourseProgressSectionProps> = ({ courseInstanceId }) => {
  const { t } = useTranslation()
  const progressQuery = useQuery({
    ...getCourseMaterialUserCourseProgressOptions({
      path: { course_instance_id: courseInstanceId },
    }),
  })

  return (
    <QueryResult
      query={progressQuery}
      emptyFallback={<GenericInfobox>{t("no-progress-to-show-yet")}</GenericInfobox>}
    >
      {(modules) => (
        <>
          {modules
            .toSorted((a, b) => a.course_module_order_number - b.course_module_order_number)
            .map((courseModuleProgress) => (
              <div key={courseModuleProgress.course_module_id}>
                <h4 className={moduleNameCss}>{courseModuleProgress.course_module_name}</h4>
                <CourseModuleProgressBars courseModuleProgress={courseModuleProgress} />
              </div>
            ))}
        </>
      )}
    </QueryResult>
  )
}

export default withErrorBoundary(CourseProgressSection)
