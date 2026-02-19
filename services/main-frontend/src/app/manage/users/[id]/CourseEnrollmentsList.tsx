"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import { getCourseEnrollmentsInfo } from "@/services/backend/users"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"

export interface CourseEnrollmentsListProps {
  userId: string
}

const CourseEnrollmentsList: React.FC<CourseEnrollmentsListProps> = ({ userId }) => {
  const { t } = useTranslation()
  const courseEnrollmentsQuery = useQuery({
    queryKey: ["course-enrollments", userId],
    queryFn: () => getCourseEnrollmentsInfo(userId),
  })
  if (courseEnrollmentsQuery.isError) {
    return <ErrorBanner variant="readOnly" error={courseEnrollmentsQuery.error} />
  }
  if (courseEnrollmentsQuery.isLoading || !courseEnrollmentsQuery.data) {
    return <Spinner variant="medium" />
  }

  return (
    <div>
      {courseEnrollmentsQuery.data.course_enrollments.map((enrollment) => {
        const { course, course_module_completions, first_enrolled_at, is_current } = enrollment
        const numDistinctModules = new Set(
          course_module_completions.map((cmc) => cmc.course_module_id),
        ).size
        const noCourseModuleCompletedTwice = course_module_completions.length === numDistinctModules

        return (
          <div
            key={enrollment.course_id}
            data-testid="course-status-card"
            className={css`
              padding: 1rem;
              margin: 1rem 0;
              border: 1px solid #ccc;
              ${!is_current &&
              `
              opacity: 0.7;
              `}
            `}
          >
            <div
              className={css`
                margin-bottom: 0.5rem;
              `}
            >
              <p>
                {t("course")}: {course.name} ({course.slug})
              </p>
              <p>
                {t("course-language")}: {course.language_code}
              </p>
              <p>
                {t("label-created-at")}: {dateToString(first_enrolled_at)}
              </p>
              <p>
                {t("label-current")}: {is_current.toString()}
              </p>
              <p>
                {t("label-course-module-completions")}:{" "}
                {noCourseModuleCompletedTwice
                  ? course_module_completions.length
                  : t(
                      "text-decribe-course-module-completions-count-when-some-modules-completed-more-than-once",
                      {
                        count: course_module_completions.length,
                        numDistinctModules,
                      },
                    )}
              </p>
            </div>
            <Link href={courseUserStatusSummaryRoute(enrollment.course_id, userId)}>
              <Button variant="tertiary" size="medium">
                {t("course-status-summary")}
              </Button>
            </Link>
          </div>
        )
      })}
    </div>
  )
}

export default CourseEnrollmentsList
