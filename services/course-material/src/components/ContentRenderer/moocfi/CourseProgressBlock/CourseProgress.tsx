import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { UserCourseInstanceProgress } from "../../../../shared-module/bindings"
import Progress from "../../../../shared-module/components/CourseProgress"

import ModuleProgress from "./ModuleProgress"

export interface CourseProgressProps {
  userCourseInstanceProgress: UserCourseInstanceProgress
}

const Wrapper = styled.div`
  background-color: #f5f6f7;
  margin: 0.5rem 0;
  padding: 2rem 4rem;
`

const CourseProgress: React.FC<CourseProgressProps> = ({ userCourseInstanceProgress }) => {
  const { t } = useTranslation()
  return (
    <>
      <Wrapper>
        <ModuleProgress
          exercisesAnswered={userCourseInstanceProgress.attempted_exercises ?? ""}
          exercisesNeededToAnswer={userCourseInstanceProgress.total_exercises ?? ""}
          totalExercises={userCourseInstanceProgress.total_exercises ?? ""}
        />
      </Wrapper>
      <Wrapper>
        <div
          className={css`
            width: 100%;
            margin: 0 auto;
            text-align: center;
            padding: 2em 0;
          `}
        >
          {/* TODO: Verify how it looks when score_given is a floating number */}
          <Progress
            variant={"circle"}
            max={userCourseInstanceProgress.score_maximum}
            given={userCourseInstanceProgress.score_given}
            point={50}
            label={t("course-progress")}
          />
          <Progress
            variant={"bar"}
            showAsPercentage={true}
            exercisesAttempted={userCourseInstanceProgress.attempted_exercises}
            exercisesTotal={userCourseInstanceProgress.total_exercises}
          />
        </div>
      </Wrapper>
    </>
  )
}

export default CourseProgress
