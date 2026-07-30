"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseModuleProgressBars from "@/components/course-material/ContentRenderer/moocfi/CourseProgressBlock/CourseModuleProgressBars"
import { getCourseMaterialUserCourseProgressOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Infobox, QueryResult } from "@/shared-module/components"

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
 * Fetches on mount: keep it behind the accordion or a student with many courses pays a request
 * per course on first paint. Own error boundary so a failure cannot blank the record beside it.
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
      emptyFallback={<Infobox>{t("no-progress-to-show-yet")}</Infobox>}
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
