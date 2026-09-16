"use client"

import { css } from "@emotion/css"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import React from "react"

import Button from "./Button"
import SpeechBalloon from "./SpeechBalloon"

interface InfoComponentProps {
  label?: string
  text: string
  right?: boolean
  boldLabel?: boolean
}

const InfoComponent: React.FC<React.PropsWithChildren<InfoComponentProps>> = ({
  label,
  text,
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
      <span
        className={css`
          position: relative;
          display: inline-flex;

          &:has(button:hover) > div,
          &:has(button:hover) > div {
            visibility: visible;
            opacity: 1;
            transition: opacity 0.3s ease;
          }
        `}
      >
        <Button size="small" aria-label={label} variant="icon">
          <InfoCircle size={18} />
        </Button>
        <SpeechBalloon
          className={css`
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
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
      </span>
    </span>
  )
}

export default InfoComponent
