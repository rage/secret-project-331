import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { border, color, space } from "styled-system"

import { fontWeights, primaryFont, theme, typography } from "../utils"

export interface SpeechBalloonProps {
  content: string
}

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
        `}
      >
        {children}
      </div>
      <div
        className={css`
          width: 1rem;
          height: 1rem;
          border: 1px solid black;
          transform: rotate(45deg);
        `}
      />
    </div>
  )
}

export default SpeechBalloon
