"use client"

import { css } from "@emotion/css"
import React from "react"

import { dateToString } from "../utils/time"
import HideTextInSystemTests from "./system-tests/HideTextInSystemTests"

interface TimeComponentProps {
  label?: string
  date: Date
  right?: boolean
  boldLabel?: boolean
}

/** A timestamp with its UTC offset, e.g. `2026-10-09 14:47:33 UTC+03:00`. */
const TimeComponent: React.FC<React.PropsWithChildren<TimeComponentProps>> = ({
  label,
  date,
  right,
  boldLabel,
}) => {
  return (
    <span
      className={css`
        ${right && "float: right;"}
        display: inline-flex;
        flex-wrap: wrap;
        column-gap: 0.25rem;
        white-space: nowrap;
      `}
    >
      {label && (
        <span
          className={css`
            ${boldLabel && "font-weight: bold;"}
          `}
        >
          {label}
        </span>
      )}
      <span className="time-component-date">
        <HideTextInSystemTests text={dateToString(date, true)} testPlaceholder="1970-01-01 00:00" />
      </span>
    </span>
  )
}

export default TimeComponent
