"use client"

import { css } from "@emotion/css"
import React from "react"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export interface ExerciseCardHeaderProps {
  backgroundColor?: string
  title: React.ReactNode
  rightContent?: React.ReactNode
}

/** Colored top bar inside an exercise card with title and optional right-side content. */
const ExerciseCardHeader: React.FC<React.PropsWithChildren<ExerciseCardHeaderProps>> = ({
  backgroundColor = "#718dbf",
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
      background: ${backgroundColor};
      border-radius: 1rem 1rem 0 0;
      color: white;
      flex-direction: column;

      ${respondToOrLarger.xxs} {
        flex-direction: row;
      }
    `}
  >
    {title}
    {rightContent !== undefined && (
      <>
        <div
          className={css`
            flex-grow: 1;
          `}
        />
        {rightContent}
      </>
    )}
  </div>
)

export default ExerciseCardHeader
