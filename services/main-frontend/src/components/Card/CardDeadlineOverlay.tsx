"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, secondaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export const cardTopBandStyle = css`
  flex: 0 1 auto;
  text-align: center;
  background: ${baseTheme.colors.gray[100]};
  padding: 1rem 2rem;
  color: ${baseTheme.colors.gray[700]};
  font-size: 0.8em;
  font-weight: 500;

  ${respondToOrLarger.md} {
    font-size: 1em;
    padding: 1.5rem;
  }
`

const deadlineContentStyle = css`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const deadlineLabelStyle = css`
  font-family: ${secondaryFont} !important;
  font-size: 0.9rem;
  opacity: 0.8;
  text-transform: uppercase;
`

interface CardDeadlineOverlayProps {
  formattedDeadline: string | null
  formattedExerciseDeadline: string | null
  exerciseDeadlinesMultiple: boolean
}

/** Renders deadline info in a top band matching the "Available" overlay style. */
const CardDeadlineOverlay: React.FC<CardDeadlineOverlayProps> = ({
  formattedDeadline,
  formattedExerciseDeadline,
  exerciseDeadlinesMultiple,
}) => {
  const { t } = useTranslation()

  const deadlineValue =
    formattedExerciseDeadline != null
      ? exerciseDeadlinesMultiple
        ? t("chapter-card-deadline-varies-value", {
            date: formattedExerciseDeadline,
          })
        : formattedExerciseDeadline
      : formattedDeadline

  if (!deadlineValue) {
    return null
  }

  return (
    <div className={cx(cardTopBandStyle, deadlineContentStyle)}>
      <div>
        <div className={deadlineLabelStyle}>{t("chapter-card-deadline")}</div>
        <div>{deadlineValue}</div>
      </div>
    </div>
  )
}

export default CardDeadlineOverlay
