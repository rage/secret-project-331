import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "../styles"
import { runCallbackIfEnterPressed } from "../utils/accessibility"

export interface SpeechBalloonProps {
  className?: string
  onClick?: () => void
}

const SQUARE_SIZE = "1rem"

const SpeechBalloon: React.FC<SpeechBalloonProps> = ({ children, className, onClick }) => {
  const bg = baseTheme.colors.neutral[300]

  const outerCss = css`
    display: flex;
    flex-direction: column;
    align-items: center;
    width: max-content;
  `
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => onClick && runCallbackIfEnterPressed(e, onClick)}
      onClick={onClick}
      className={`${outerCss} ${className}`}
    >
      <div
        className={css`
          background: ${bg};
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
          background: ${bg};
          transform: rotate(45deg);
        `}
      />
    </div>
  )
}

export default SpeechBalloon
