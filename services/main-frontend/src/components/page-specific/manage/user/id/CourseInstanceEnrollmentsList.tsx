import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import { getCourseInstanceEnrollmentsInfo } from "../../../../../services/backend/users"

import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { courseInstanceUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"

export interface CourseInstanceEnrollmentsListProps {
  userId: string
}

const CourseInstanceEnrollmentsList: React.FC<CourseInstanceEnrollmentsListProps> = ({
  userId,
}) => {
  const { t } = useTranslation()
  const courseInstanceEnrollmentsQuery = useQuery({
    queryKey: ["course-instance-enrollments", userId],
    queryFn: () => getCourseInstanceEnrollmentsInfo(userId),
  })
  if (courseInstanceEnrollmentsQuery.isError) {
    return <ErrorBanner variant="readOnly" error={courseInstanceEnrollmentsQuery.error} />
  }
  if (courseInstanceEnrollmentsQuery.isLoading) {
    return <Spinner variant="medium" />
  }

  return (
    <div>
      {courseInstanceEnrollmentsQuery.data.course_instance_enrollments.map((enrollment) => {
        const course = courseInstanceEnrollmentsQuery.data.courses.find(
          (c) => c.id === enrollment.course_id,
        )
        const userCourseSettings = courseInstanceEnrollmentsQuery.data.user_course_settings.find(
          (ucs) => ucs.course_language_group_id === course?.course_language_group_id,
        )
        const courseInstance = courseInstanceEnrollmentsQuery.data.course_instances.find(
          (ci) => ci.id === enrollment.course_instance_id,
        )
        const courseModuleCompletions =
          courseInstanceEnrollmentsQuery.data.course_module_completions.filter(
            (cmc) => cmc.course_id === enrollment.course_id,
          )
        const numDistinctModules = new Set(
          courseModuleCompletions.map((cmc) => cmc.course_module_id),
        ).size
        const noCourseModuleCompletedTwice = courseModuleCompletions.length === numDistinctModules
        if (!course || !userCourseSettings || !courseInstance) {
          return (
            <ErrorBanner
              key={enrollment.course_instance_id}
              variant="readOnly"
              error={t(
                "could-not-find-course-course-instance-or-user-course-settings-for-enrollment",
              )}
            />
          )
        }
        const current =
          enrollment.course_instance_id === userCourseSettings.current_course_instance_id &&
          enrollment.course_id === userCourseSettings.current_course_id

        return (
          <div
            key={enrollment.course_instance_id}
            data-testid="course-status-card"
            className={css`
              padding: 1rem;
              margin: 1rem 0;
              border: 1px solid #ccc;
              ${!current &&
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
                {t("label-course-instance")}: {courseInstance.name ?? t("label-default")}
              </p>
              <p>
                {t("label-created-at")}: {dateToString(enrollment.created_at)}
              </p>
              <p>
                {t("label-current")}: {current.toString()}
              </p>
              <p>
                {t("label-course-module-completions")}:{" "}
                {noCourseModuleCompletedTwice
                  ? courseModuleCompletions.length
                  : t(
                      "text-decribe-course-module-completions-count-when-some-modules-completed-more-than-once",
                      { count: courseModuleCompletions.length, numDistinctModules },
                    )}
              </p>
            </div>
            <Link
              href={courseInstanceUserStatusSummaryRoute(enrollment.course_instance_id, userId)}
            >
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

export default CourseInstanceEnrollmentsList
