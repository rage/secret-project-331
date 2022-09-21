import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { UserCourseInstanceProgress } from "../../../../shared-module/bindings"
import Progress from "../../../../shared-module/components/CourseProgress"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"

import CompletionRequirementsTabulation from "./CompletionRequirementsTabulation"
import TempAccordionItem from "./TempAccordionItem"

export interface CourseProgressProps {
  userCourseInstanceProgress: UserCourseInstanceProgress[]
}

const Wrapper = styled.div`
  background-color: #f5f6f7;
  margin: 3px 0 6px 0;
  padding: 0;

  ${respondToOrLarger.md} {
    padding: 0.8rem 3rem 1.5rem 3rem;
  }
`
const TotalWrapper = styled.div`
  background-color: #f5f6f7;
  margin: 3px 0 3px 0;
  padding: 0.8rem 3rem 1.5rem 3rem;
`

const CourseProgress: React.FC<React.PropsWithChildren<CourseProgressProps>> = ({
  userCourseInstanceProgress,
}) => {
  const [openedModule, setOpenedModule] = useState(0)
  const { t } = useTranslation()

  const handleAccordionToggle = (sourceId: number) => {
    setOpenedModule((prev) => (prev !== sourceId ? sourceId : -1))
  }

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
      {userCourseInstanceProgress
        .sort((a, b) => a.course_module_order_number - b.course_module_order_number)
        .map((courseModuleProgress) => (
          <TempAccordionItem
            onClick={() => handleAccordionToggle(courseModuleProgress.course_module_order_number)}
            open={openedModule === courseModuleProgress.course_module_order_number}
            title={courseModuleProgress.course_module_name}
            key={courseModuleProgress.course_module_id}
          >
            <TotalWrapper>
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
                  max={courseModuleProgress.score_maximum}
                  required={courseModuleProgress.score_required ?? undefined}
                  given={courseModuleProgress.score_given}
                  label={t("total-points")}
                />
                <Progress
                  variant={"bar"}
                  showAsPercentage={false}
                  exercisesAttempted={courseModuleProgress.attempted_exercises}
                  exercisesTotal={courseModuleProgress.total_exercises}
                  required={courseModuleProgress.attempted_exercises_required ?? undefined}
                />
              </div>
            </TotalWrapper>
            <Wrapper>
              <CompletionRequirementsTabulation
                attemptedExercisesRequiredForCompletion={
                  courseModuleProgress.attempted_exercises_required
                }
                pointsRequiredForCompletion={courseModuleProgress.score_required}
              />
            </Wrapper>
          </TempAccordionItem>
        ))}
    </>
  )
}

export default CourseProgress
