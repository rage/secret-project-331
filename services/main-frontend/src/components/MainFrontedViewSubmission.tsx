import { css } from "@emotion/css"
import { CheckCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import SubmissionIFrame from "./page-specific/submissions/id/SubmissionIFrame"

import { ExerciseSlideSubmissionInfo } from "@/shared-module/common/bindings"
import { headingFont, secondaryFont } from "@/shared-module/common/styles"
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
    <section
      className={css`
        width: 100%;
        background: #f2f2f2;
        border-radius: 1rem;
        padding-bottom: 1.25rem;
        position: relative;
        max-width: ${narrowContainerWidthRem}rem;
        margin: 2rem auto 1rem auto;
      `}
    >
      <div>
        <div
          className={css`
            display: flex;
            gap: 5px;
            align-items: center;
            margin-bottom: 1.5rem;
            padding: 1.5rem 1.2rem;
            background: #718dbf;
            border-radius: 1rem 1rem 0 0;
            color: white;
            flex-direction: column;

            ${respondToOrLarger.xxs} {
              flex-direction: row;
            }
          `}
        >
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
                /* Prevents some characters, like 3, from clipping */
                padding-bottom: 0.2rem;

                ${respondToOrLarger.xs} {
                  max-height: 60px;
                }
              `}
            >
              {submissionData.exercise.name}
            </div>
          </h2>
          <div
            className={css`
              flex-grow: 1;
            `}
          />
          <div
            className={css`
              font-size: 9px;
              text-align: center;
              font-family: ${secondaryFont} !important;
              text-transform: uppercase;
              border-radius: 10px;
              background: #f0f0f0;
              height: 60px;
              padding: 8px 16px 6px 16px;

              color: #57606f;
              display: flex;
              justify-content: center;
              flex-direction: columns;
              gap: 16px;
              box-shadow:
                rgba(45, 35, 66, 0) 0 2px 4px,
                rgba(45, 35, 66, 0) 0 7px 13px -3px,
                #c4c4c4 0 -3px 0 inset;

              .points {
                line-height: 100%;
                color: #57606f;
                z-index: 999;
              }

              .heading {
                color: #57606f;
                font-size: 12px;
                display: inline-block;
                margin-bottom: 2px;
              }

              sup,
              sub {
                font-family: ${headingFont} !important;
                color: #57606f;
                font-size: 15px;
                font-weight: 500;
                margin: 0;
              }

              svg {
                margin-right: 4px;
              }

              width: 100%;
              ${respondToOrLarger.xxs} {
                width: auto;
              }
            `}
          >
            <div>
              <span className="heading">{t("points-label")}</span>
              <div className="points">
                <CheckCircle size={16} weight="bold" color="#394F77" />
                <span data-testid="submission-points">
                  <sup>{totalScoreGiven ?? 0}</sup>/
                  <sub>{submissionData.exercise.score_maximum}</sub>
                </span>
              </div>
            </div>
          </div>
        </div>
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
      </div>
    </section>
  )
}

export default MainFrontedViewSubmission
