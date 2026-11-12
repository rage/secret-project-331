"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import SubmissionIFrame from "@/app/(layout)/submissions/[id]/grading/SubmissionIFrame"
import {
  ExerciseCardHeader,
  ExerciseCardPointsBadge,
  ExerciseCardWrapper,
} from "@/components/exercise-card"
import type { ExerciseSlideSubmissionInfo } from "@/generated/api/types.generated"
import { headingFont } from "@/shared-module/common/styles"
import { narrowContainerWidthRem } from "@/shared-module/common/styles/constants"

interface MainFrontedViewSubmissionProps {
  submissionData: Pick<ExerciseSlideSubmissionInfo, "exercise" | "tasks">
  totalScoreGiven: number | null | undefined
  /** `false` for an ungraded answer snapshot: no points badge, and tasks render without a grading. */
  isGraded?: boolean
}

const MainFrontedViewSubmission: React.FC<MainFrontedViewSubmissionProps> = ({
  submissionData,
  totalScoreGiven,
  isGraded = true,
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
                min-width: 0;
                margin-top: -2px;
              `}
            >
              <div
                className={css`
                  font-weight: 600;
                  font-size: 18px;
                  margin-bottom: 0.25rem;
                `}
              >
                {t("submission")}:
              </div>
              <div
                className={css`
                  line-height: 30px;
                  padding-bottom: 0.2rem;
                `}
              >
                {submissionData.exercise.name}
              </div>
            </h2>
          }
          rightContent={
            isGraded ? (
              <ExerciseCardPointsBadge
                score={totalScoreGiven ?? null}
                maxScore={submissionData.exercise.score_maximum}
                // oxlint-disable-next-line i18next/no-literal-string
                dataTestId="submission-points"
              />
            ) : undefined
          }
        />
        <div
          className={css`
            padding: 0 1rem;
          `}
        >
          {submissionData.tasks
            .toSorted((a, b) => a.order_number - b.order_number)
            .map((task) => (
              <SubmissionIFrame
                key={task.id}
                coursematerialExerciseTask={task}
                isGraded={isGraded}
              />
            ))}
        </div>
      </ExerciseCardWrapper>
    </div>
  )
}

export default MainFrontedViewSubmission
