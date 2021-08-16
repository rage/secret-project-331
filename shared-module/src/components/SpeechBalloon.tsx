import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { border, color, space } from "styled-system"

import { fontWeights, primaryFont, theme, typography } from "../utils"

export interface SpeechBalloonProps {
  content: string
}

const SQUARE_SIZE = "1rem"

const SpeechBalloon: React.FC = ({ children }) => {
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        width: max-content;
      `}
    >
      <div
        className={css`
          border: 1px solid black;
          width: max-content;
          padding: 1rem;
        `}
      >
        {children}
      </div>
      <div
        className={css`
          width: ${SQUARE_SIZE};
          height: ${SQUARE_SIZE};
          position: relative;
          top: calc(-${SQUARE_SIZE} / 2);
          border: 1px solid black;
          transform: rotate(45deg);
        `}
      />
    </div>
  )
}

export default SpeechBalloon
