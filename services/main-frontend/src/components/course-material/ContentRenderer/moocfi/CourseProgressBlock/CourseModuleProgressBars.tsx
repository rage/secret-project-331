"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import CircularProgress from "@/components/course-progress/CircularProgress"
import PointsBreakdownButton from "@/components/course-progress/PointsBreakdownButton"
import type { CourseInstanceLocation } from "@/components/course-progress/PointsBreakdownDialog"
import ProgressBar from "@/components/course-progress/ProgressBar"
import {
  describeProgress,
  PROGRESS_UNIT,
  type ProgressMeasure,
  withoutEmptyThreshold,
} from "@/components/course-progress/progressText"
import type { UserCourseProgress } from "@/generated/course-material-api/types.generated"

import CompletionRequirementsTabulation from "./CompletionRequirementsTabulation"

export interface CourseModuleProgressBarsProps {
  courseModuleProgress: UserCourseProgress
  /** `null` leaves out the button that lists every exercise. */
  courseInstanceLocation: CourseInstanceLocation | null
}

const Wrapper = styled.div`
  background-color: rgba(242, 245, 247, 0.8);
  margin: 3px 0 6px 0;
  padding: 0;
`
const TotalWrapper = styled.div`
  background-color: rgb(242, 245, 247);
  margin: 3px 0 3px 0;
  padding: 0.8rem 3rem 0 3rem;
`

/** One module's progress inside the course-material progress block's accordion. */
const CourseModuleProgressBars: React.FC<CourseModuleProgressBarsProps> = ({
  courseModuleProgress,
  courseInstanceLocation,
}) => {
  const { t, i18n } = useTranslation()
  const requiresExam = courseModuleProgress.requires_exam
  const points: ProgressMeasure = withoutEmptyThreshold({
    given: courseModuleProgress.score_given,
    max: courseModuleProgress.score_maximum ?? null,
    required: courseModuleProgress.score_required ?? null,
  })
  const exercises: ProgressMeasure = withoutEmptyThreshold({
    given: courseModuleProgress.attempted_exercises ?? null,
    max: courseModuleProgress.total_exercises ?? null,
    required: courseModuleProgress.attempted_exercises_required ?? null,
  })
  const pointsText = describeProgress(PROGRESS_UNIT.POINTS, points, t, i18n.language, requiresExam)
  const exercisesText = describeProgress(
    PROGRESS_UNIT.EXERCISES,
    exercises,
    t,
    i18n.language,
    requiresExam,
  )

  return (
    <>
      <TotalWrapper>
        <div
          className={css`
            width: 100%;
            margin: 0 auto;
            text-align: center;
            padding: 2em 0;

            /** Make sure the visualization does not make the page wider on mobile */
            max-width: 100%;
            overflow: hidden;
          `}
        >
          <CircularProgress
            max={points.max}
            {...(points.required !== null && { required: points.required })}
            given={points.given}
            label={t("course-progress")}
            valueText={pointsText.valueText}
            explanations={pointsText.explanations}
          />
          <ProgressBar
            exercisesAttempted={exercises.given}
            exercisesTotal={exercises.max}
            {...(exercises.required !== null && { required: exercises.required })}
            label={t("exercises-attempted")}
            valueText={exercisesText.valueText}
            explanations={exercisesText.explanations}
          />
          {courseInstanceLocation && (
            <PointsBreakdownButton
              scope={{
                ...courseInstanceLocation,
                courseModuleId: courseModuleProgress.course_module_id,
              }}
              points={points}
              exercises={exercises}
            />
          )}
        </div>
      </TotalWrapper>
      <Wrapper>
        <CompletionRequirementsTabulation
          attemptedExercisesRequiredForCompletion={exercises.required}
          pointsRequiredForCompletion={points.required}
          requiresExam={requiresExam}
        />
      </Wrapper>
    </>
  )
}

export default CourseModuleProgressBars
