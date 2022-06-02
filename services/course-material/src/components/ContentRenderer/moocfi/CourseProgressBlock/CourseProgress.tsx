import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faAngleDown, faAngleUp } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { UserCourseInstanceProgress } from "../../../../shared-module/bindings"
import Progress from "../../../../shared-module/components/CourseProgress"
import { runCallbackIfEnterPressed } from "../../../../shared-module/utils/accessibility"

import ModuleProgress from "./ModuleProgress"

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
      <TempAccordion
        onClick={() => setOpenedModule((prev) => (prev !== 0 ? 0 : -1))}
        open={openedModule === 0}
        title={userCourseInstanceProgress.module_name}
      >
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
              label={t("total-points-in-name", { name: userCourseInstanceProgress.module_name })}
            />
            <Progress
              variant={"bar"}
              showAsPercentage={true}
              exercisesAttempted={userCourseInstanceProgress.attempted_exercises}
              exercisesTotal={userCourseInstanceProgress.total_exercises}
            />
          </div>
        </Wrapper>
      </TempAccordion>
    </>
  )
}

export default CourseProgress

// This should be replaced when the shared module one once it's implemented
const TempAccordion: React.FC<{ title: string; open: boolean; onClick: () => void }> = ({
  title,
  open,
  onClick,
  children,
}) => {
  const faIcon = open ? faAngleUp : faAngleDown
  return (
    <div>
      <div
        onClick={onClick}
        onKeyDown={(e) => runCallbackIfEnterPressed(e, onClick)}
        role="button"
        tabIndex={0}
        className={css`
          background-color: #f5f6f7;
          cursor: pointer;
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          padding: 1rem 2rem;
        `}
      >
        <div
          className={css`
            flex: 1;
          `}
        >
          {title}
        </div>
        <div
          className={css`
            flex: 0 0 auto;
          `}
        >
          <FontAwesomeIcon icon={faIcon} />
        </div>
      </div>
      {open ? <div>{children}</div> : null}
    </div>
  )
}
