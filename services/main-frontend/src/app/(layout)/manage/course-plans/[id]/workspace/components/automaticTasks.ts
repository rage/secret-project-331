import type { TFunction } from "i18next"

import type {
  CourseDesignerAutomaticCheck,
  CourseDesignerCourseStatus,
} from "@/generated/api/types.generated"
import {
  manageCourseOverviewRoute,
  manageCoursePagesRoute,
} from "@/shared-module/common/utils/routes"

/** Why an automatic task is or is not done, from the course's current state. */
export function automaticTaskReason(
  check: CourseDesignerAutomaticCheck,
  courseStatus: CourseDesignerCourseStatus | null | undefined,
  t: TFunction,
): string {
  if (!courseStatus) {
    return t("course-plans-task-reason-no-course")
  }
  switch (check) {
    case "ContentFilled": {
      const count = courseStatus.unfilled_pages.length
      return count === 0
        ? t("course-plans-task-reason-content-filled-done")
        : t("course-plans-task-reason-content-filled-open", { count })
    }
    case "ExercisesExist": {
      if (courseStatus.chapter_count === 0) {
        return t("course-plans-course-status-no-chapters")
      }
      const count = courseStatus.chapters_without_exercises.length
      return count === 0
        ? t("course-plans-task-reason-exercises-done")
        : t("course-plans-task-reason-exercises-open", { count })
    }
    case "CoursePublished":
      return courseStatus.is_draft
        ? t("course-plans-task-reason-published-open")
        : t("course-plans-task-reason-published-done")
  }
}

/** Where the teacher fixes what an automatic task checks. */
export function automaticTaskLink(
  check: CourseDesignerAutomaticCheck,
  courseId: string,
  t: TFunction,
): { href: string; label: string } {
  switch (check) {
    case "ContentFilled":
    case "ExercisesExist":
      return { href: manageCoursePagesRoute(courseId), label: t("course-plans-task-link-pages") }
    case "CoursePublished":
      return {
        href: manageCourseOverviewRoute(courseId),
        label: t("course-plans-task-link-overview"),
      }
  }
}
