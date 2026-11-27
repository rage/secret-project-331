import type { TFunction } from "i18next"

import type {
  CourseDesignerAutomaticCheck,
  CourseDesignerCourseStatus,
} from "@/generated/api/types.generated"
import {
  manageCourseOverviewRoute,
  manageCoursePagesRoute,
} from "@/shared-module/common/utils/routes"

/** Why an automatic task is or is not done. `isCompleted` is the server's verdict; the course status only supplies counts. */
export function automaticTaskReason(
  check: CourseDesignerAutomaticCheck,
  isCompleted: boolean,
  courseStatus: CourseDesignerCourseStatus | null | undefined,
  t: TFunction,
): string {
  if (!courseStatus) {
    return t("course-plans-task-reason-no-course")
  }
  switch (check) {
    case "ContentFilled":
      return isCompleted
        ? t("course-plans-task-reason-content-filled-done")
        : t("course-plans-task-reason-content-filled-open", {
            count: courseStatus.unfilled_pages.length,
          })
    case "ExercisesExist":
      if (isCompleted) {
        return t("course-plans-task-reason-exercises-done")
      }
      return courseStatus.chapter_count === 0
        ? t("course-plans-course-status-no-chapters")
        : t("course-plans-task-reason-exercises-open", {
            count: courseStatus.chapters_without_exercises.length,
          })
    case "CoursePublished":
      return isCompleted
        ? t("course-plans-task-reason-published-done")
        : t("course-plans-task-reason-published-open")
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
