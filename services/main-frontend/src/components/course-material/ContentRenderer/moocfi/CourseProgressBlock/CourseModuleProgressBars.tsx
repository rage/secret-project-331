"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import type { UserCourseProgress } from "@/generated/course-material-api/types.generated"
import Progress from "@/shared-module/common/components/CourseProgress"
import { includeIf } from "@/shared-module/common/utils/nullability"

import ColorsIdentifier from "./ColorsIdentifier"
import CompletionRequirementsTabulation from "./CompletionRequirementsTabulation"

export interface CourseModuleProgressBarsProps {
  courseModuleProgress: UserCourseProgress
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

/** Shared by the course-material progress block and the profile's studies tab. */
const CourseModuleProgressBars: React.FC<CourseModuleProgressBarsProps> = ({
  courseModuleProgress,
}) => {
  const { t } = useTranslation()

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
          {/* TODO: Verify how it looks when score_given is a floating number */}
          <Progress
            variant={"circle"}
            max={courseModuleProgress.score_maximum ?? null}
            {...includeIf(
              courseModuleProgress.score_required !== null &&
                courseModuleProgress.score_required !== undefined,
              { required: courseModuleProgress.score_required },
            )}
            given={courseModuleProgress.score_given ?? null}
            label={t("total-points")}
          />
          <Progress
            variant={"bar"}
            showAsPercentage={false}
            exercisesAttempted={courseModuleProgress.attempted_exercises ?? null}
            exercisesTotal={courseModuleProgress.total_exercises ?? null}
            {...includeIf(
              courseModuleProgress.attempted_exercises_required !== null &&
                courseModuleProgress.attempted_exercises_required !== undefined,
              { required: courseModuleProgress.attempted_exercises_required },
            )}
            label={t("exercises-attempted")}
          />
          <ColorsIdentifier
            studentPoints={courseModuleProgress.score_given ?? null}
            requiredPoints={courseModuleProgress.score_required ?? null}
            maxPoints={courseModuleProgress.score_maximum ?? null}
            // The exercises bar above also draws a required marker, from attempted_exercises_required.
            showRequiredLegend={
              (courseModuleProgress.score_required !== null &&
                courseModuleProgress.score_required !== undefined) ||
              (courseModuleProgress.attempted_exercises_required !== null &&
                courseModuleProgress.attempted_exercises_required !== undefined)
            }
          />
        </div>
      </TotalWrapper>
      <Wrapper>
        <CompletionRequirementsTabulation
          attemptedExercisesRequiredForCompletion={
            courseModuleProgress.attempted_exercises_required ?? null
          }
          pointsRequiredForCompletion={courseModuleProgress.score_required ?? null}
        />
      </Wrapper>
    </>
  )
}

export default CourseModuleProgressBars
