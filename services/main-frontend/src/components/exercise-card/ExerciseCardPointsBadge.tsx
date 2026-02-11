"use client"

import { css } from "@emotion/css"
import { CheckCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { headingFont, secondaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export interface ExerciseCardPointsBadgeProps {
  score: number
  maxScore: number
}

/** Rounded pill showing exercise points with CheckCircle icon and sup/sub formatting. */
const ExerciseCardPointsBadge: React.FC<React.PropsWithChildren<ExerciseCardPointsBadgeProps>> = ({
  score,
  maxScore,
}) => {
  const { t } = useTranslation()

  return (
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
        flex-direction: column;
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
          <span data-testid="exercise-points">
            <sup>{score}</sup>/<sub>{maxScore}</sub>
          </span>
        </div>
      </div>
    </div>
  )
}

export default ExerciseCardPointsBadge
