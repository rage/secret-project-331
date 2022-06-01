import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchUserCourseProgress } from "../../../../services/backend"
import Progress from "../../../../shared-module/components/CourseProgress"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"

import ModuleProgress from "./ModuleProgress"

interface CourseProgressProps {
  courseInstanceId: string
}

const Wrapper = styled.div`
  background-color: #f5f6f7;
  margin: 0.5rem 0;
  padding: 2rem 4rem;
`

const CourseProgress: React.FC<CourseProgressProps> = ({ courseInstanceId }) => {
  const { t } = useTranslation()
  const getUserCourseProgress = useQuery(`course-instance-${courseInstanceId}-progress`, () =>
    fetchUserCourseProgress(courseInstanceId),
  )

  return (
    <>
      {getUserCourseProgress.isError && (
        <ErrorBanner variant={"readOnly"} error={getUserCourseProgress.error} />
      )}
      {(getUserCourseProgress.isLoading || getUserCourseProgress.isIdle) && (
        <Spinner variant={"medium"} />
      )}
      {getUserCourseProgress.isSuccess && (
        <>
          <Wrapper>
            <ModuleProgress
              exercisesAnswered={getUserCourseProgress.data.attempted_exercises ?? ""}
              exercisesNeededToAnswer={getUserCourseProgress.data.total_exercises ?? ""}
              totalExercises={getUserCourseProgress.data.total_exercises ?? ""}
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
                max={getUserCourseProgress.data.score_maximum}
                given={getUserCourseProgress.data.score_given}
                point={50}
                label={t("course-progress")}
              />
              <Progress
                variant={"bar"}
                showAsPercentage={true}
                exercisesAttempted={getUserCourseProgress.data.attempted_exercises}
                exercisesTotal={getUserCourseProgress.data.total_exercises}
              />
            </div>
          </Wrapper>
        </>
      )}
    </>
  )
}

export default CourseProgress
