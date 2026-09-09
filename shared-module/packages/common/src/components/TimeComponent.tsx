"use client"

import { css } from "@emotion/css"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import React from "react"

import { dateToString } from "../utils/time"
import Button from "./Button"
import SpeechBalloon from "./SpeechBalloon"
import HideTextInSystemTests from "./system-tests/HideTextInSystemTests"

interface TimeComponentProps {
  label?: string
  date: Date
  right?: boolean
  boldLabel?: boolean
}

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
        vertical-align: middle;
        position: relative;
      `}
    >
      {label && (
        <span
          className={css`
            ${boldLabel && "font-weight: bold;"}
            margin-right: 0.2rem;
          `}
        >
          {label}
        </span>
      )}
      <span className="time-component-date">
        <HideTextInSystemTests
          text={dateToString(date, false)}
          testPlaceholder="1970-01-01 00:00"
        />
      </span>
      <Button
        size="small"
        aria-label={dateToString(date, true)}
        className={css`
          position: relative;
          display: inline-flex;
        `}
        variant={"icon"}
      >
        <InfoCircle
          size={18}
          className={css`
            &:hover + div {
              visibility: visible;
            }
          `}
        />
        <SpeechBalloon
          className={css`
            bottom: 100%;
            visibility: hidden;
          `}
        >
          <p> {dateToString(date, true)} </p>
        </SpeechBalloon>
      </Button>
    </span>
  )
}

export default TimeComponent
