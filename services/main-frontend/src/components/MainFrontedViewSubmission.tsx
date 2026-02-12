"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import SubmissionIFrame from "@/app/submissions/[id]/grading/SubmissionIFrame"
import {
  ExerciseCardHeader,
  ExerciseCardPointsBadge,
  ExerciseCardWrapper,
} from "@/components/exercise-card"
import { ExerciseSlideSubmissionInfo } from "@/shared-module/common/bindings"
import { headingFont } from "@/shared-module/common/styles"
import { narrowContainerWidthRem } from "@/shared-module/common/styles/constants"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface MainFrontedViewSubmissionProps {
  submissionData: ExerciseSlideSubmissionInfo
  totalScoreGiven: number | null | undefined
}

const MainFrontedViewSubmission: React.FC<MainFrontedViewSubmissionProps> = ({
  submissionData,
  totalScoreGiven,
}) => {
  const { t } = useTranslation()

  return (
    <div
      className={css`
        max-width: ${narrowContainerWidthRem}rem;
        margin: 2rem auto 1rem auto;
        width: 100%;
      `}
    >
      <ExerciseCardWrapper>
        <ExerciseCardHeader
          title={
            <h2
              className={css`
                font-size: 1.7rem;
                font-weight: 500;
                font-family: ${headingFont} !important;
                overflow-wrap: anywhere;
                overflow: hidden;
                margin-top: -2px;
              `}
            >
              <div
                className={css`
                  font-weight: 600;
                  font-size: 18px;
                  margin-bottom: 0.25rem;
                  color: #1b222c;
                `}
              >
                {t("submission")}:
              </div>
              <div
                className={css`
                  line-height: 30px;
                  overflow: hidden;
                  max-height: 80px;
                  padding-bottom: 0.2rem;

                  ${respondToOrLarger.xs} {
                    max-height: 60px;
                  }
                `}
              >
                {submissionData.exercise.name}
              </div>
            </h2>
          }
          rightContent={
            <ExerciseCardPointsBadge
              score={totalScoreGiven ?? 0}
              maxScore={submissionData.exercise.score_maximum}
              // eslint-disable-next-line i18next/no-literal-string
              dataTestId="submission-points"
            />
          }
        />
        <div
          className={css`
            padding: 0 1rem;
          `}
        >
          {submissionData.tasks
            .sort((a, b) => a.order_number - b.order_number)
            .map((task) => (
              <SubmissionIFrame key={task.id} coursematerialExerciseTask={task} />
            ))}
        </div>
      </ExerciseCardWrapper>
    </div>
  )
}

export default MainFrontedViewSubmission
