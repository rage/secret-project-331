"use client"

import { css } from "@emotion/css"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import React from "react"

import Button from "./Button"
import SpeechBalloon from "./SpeechBalloon"

interface TimeComponentProps {
  label?: string
  text: string
  right?: boolean
  boldLabel?: boolean
}

const TimeComponent: React.FC<React.PropsWithChildren<TimeComponentProps>> = ({
  label,
  text,
  right,
  boldLabel,
}) => {
  return (
    <span
      className={css`
        ${right && "float: right;"}
        z-index: 1100;
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
      <Button
        size="small"
        aria-label={label}
        className={css`
          position: relative;
          display: inline-flex;

          &:hover > div,
          &:focus-visible > div {
            visibility: visible;
            opacity: 1;
            transition: opacity 0.3s ease;
          }
        `}
        variant={"icon"}
      >
        <InfoCircle size={18} />
        <SpeechBalloon
          className={css`
            position: absolute;
            bottom: 100%;
            visibility: hidden;
            opacity: 0;
          `}
        >
          <p
            className={css`
              max-width: 17rem !important;
              text-transform: None;
            `}
          >
            {text}
          </p>
        </SpeechBalloon>
      </Button>
    </span>
  )
}

export default TimeComponent
