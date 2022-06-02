import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { UserCourseInstanceProgress } from "../../../../shared-module/bindings"
import Progress from "../../../../shared-module/components/CourseProgress"

import ExerciseCountDisplay from "./ExerciseCountDisplay"
import TempAccordionItem from "./TempAccordionItem"

export interface CourseProgressProps {
  userCourseInstanceProgress: UserCourseInstanceProgress
}

const Wrapper = styled.div`
  background-color: #f5f6f7;
  margin: 0 0 0.5rem;
  padding: 0 4rem 2rem;
`

const CourseProgress: React.FC<CourseProgressProps> = ({ userCourseInstanceProgress }) => {
  const [openedModule, setOpenedModule] = useState(0)
  const { t } = useTranslation()
  return (
    <>
      <h2
        className={css`
          font-size: 2.5rem;
          font-weight: 350;
          margin: 1rem;
          text-align: center;
        `}
      >
        {t("track-your-progress")}
      </h2>
      {/* TO IMPLEMENT: Map module data to accordions. Are we even going to use accordion?*/}
      <TempAccordionItem
        onClick={() => setOpenedModule((prev) => (prev !== 0 ? 0 : -1))}
        open={openedModule === 0}
        title={userCourseInstanceProgress.module_name}
      >
        <Wrapper>
          <ExerciseCountDisplay
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
              label={t("total-points")}
            />
            <Progress
              variant={"bar"}
              showAsPercentage={true}
              exercisesAttempted={userCourseInstanceProgress.attempted_exercises}
              exercisesTotal={userCourseInstanceProgress.total_exercises}
            />
          </div>
        </Wrapper>
      </TempAccordionItem>
    </>
  )
}

export default CourseProgress
