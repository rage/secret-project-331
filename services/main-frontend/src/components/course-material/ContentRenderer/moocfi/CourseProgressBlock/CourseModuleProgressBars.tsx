"use client"

import { css } from "@emotion/css"
import React from "react"

import type { CourseInstanceLocation } from "@/components/course-progress/PointsBreakdownDialog"
import ProgressCard from "@/components/course-progress/ProgressCard"
import type { UserCourseProgress } from "@/generated/course-material-api/types.generated"

/** One module's progress, as the course-material API returns it. */
export interface CourseModuleProgressBarsProps {
  courseModuleProgress: UserCourseProgress
  /** `null` leaves out the button that lists every exercise. */
  courseInstanceLocation: CourseInstanceLocation | null
}

/** One module's progress card inside the course-material progress block's accordion. */
const CourseModuleProgressBars: React.FC<CourseModuleProgressBarsProps> = ({
  courseModuleProgress,
  courseInstanceLocation,
}) => (
  <div
    className={css`
      margin-bottom: 6px;
    `}
  >
    <ProgressCard
      variant="module"
      headingLevel={3}
      moduleName={courseModuleProgress.course_module_name}
      requiresExam={courseModuleProgress.requires_exam}
      automaticCompletion={courseModuleProgress.automatic_completion}
      pointsBreakdown={
        courseInstanceLocation && {
          ...courseInstanceLocation,
          courseModuleId: courseModuleProgress.course_module_id,
        }
      }
      points={{
        given: courseModuleProgress.score_given,
        max: courseModuleProgress.score_maximum ?? null,
        required: courseModuleProgress.score_required ?? null,
      }}
      exercises={{
        given: courseModuleProgress.attempted_exercises ?? null,
        max: courseModuleProgress.total_exercises ?? null,
        required: courseModuleProgress.attempted_exercises_required ?? null,
      }}
    />
  </div>
)

export default CourseModuleProgressBars
