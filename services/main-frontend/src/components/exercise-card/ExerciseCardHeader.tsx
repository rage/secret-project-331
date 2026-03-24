"use client"

import { css } from "@emotion/css"
import React from "react"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const EXERCISE_CARD_HEADER_BACKGROUND = "#5372B2"
const EXERCISE_CARD_HEADER_FOREGROUND = "#ffffff"

export interface ExerciseCardHeaderProps {
  title: React.ReactNode
  rightContent?: React.ReactNode
}

/** Colored top bar inside an exercise card with title and optional right-side content. */
const ExerciseCardHeader: React.FC<React.PropsWithChildren<ExerciseCardHeaderProps>> = ({
  title,
  rightContent,
}) => (
  <div
    className={css`
      display: flex;
      gap: 5px;
      align-items: center;
      margin-bottom: 1.5rem;
      padding: 1.5rem 1.2rem;
      background: ${EXERCISE_CARD_HEADER_BACKGROUND};
      border-radius: 1rem 1rem 0 0;
      color: ${EXERCISE_CARD_HEADER_FOREGROUND};
      flex-direction: column;

      ${respondToOrLarger.xxs} {
        flex-direction: row;
      }
    `}
  >
    <div
      className={css`
        ${respondToOrLarger.xxs} {
          min-width: 0;
          flex: 1 1 auto;
        }
      `}
    >
      {title}
    </div>
    {rightContent !== undefined && (
      <div
        className={css`
          ${respondToOrLarger.xxs} {
            flex-shrink: 0;
          }
        `}
      >
        {rightContent}
      </div>
    )}
  </div>
)

export default ExerciseCardHeader
