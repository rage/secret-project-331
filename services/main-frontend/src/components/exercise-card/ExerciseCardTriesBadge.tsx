"use client"

import { css, cx } from "@emotion/css"
import { PlusHeart } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { exerciseCardPillShell } from "./exerciseCardPillShell"

import { headingFont } from "@/shared-module/common/styles"

export interface ExerciseCardTriesBadgeProps {
  triesRemaining: number
}

/** Rounded pill showing remaining tries with PlusHeart icon and count. */
const ExerciseCardTriesBadge: React.FC<React.PropsWithChildren<ExerciseCardTriesBadgeProps>> = ({
  triesRemaining,
}) => {
  const { t } = useTranslation()

  return (
    <div
      className={cx(
        exerciseCardPillShell,
        css`
          .heading {
            color: #57606f;
            font-size: 12px;
            display: inline-block;
            margin-bottom: 2px;
          }

          .tries {
            font-family: ${headingFont} !important;
            display: flex;
            color: #57606f;
            font-size: 14px;
            font-weight: 500;
            line-height: 0.8;
          }

          p {
            font-size: 16px;
            margin: 0;
          }

          svg {
            flex-shrink: 0;
            margin-right: 4px;
          }
        `,
      )}
    >
      <div>
        <span className="heading">{t("tries")}</span>
        <div className="tries">
          <PlusHeart size={16} weight="bold" color="#394F77" />
          <p>{triesRemaining}</p>
        </div>
      </div>
    </div>
  )
}

export default ExerciseCardTriesBadge
