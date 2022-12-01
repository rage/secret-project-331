import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "../styles"
import { runCallbackIfEnterPressed } from "../utils/accessibility"

export interface SpeechBalloonProps {
  className?: string
  onClick?: () => void
  children?: React.ReactNode
}

const SQUARE_SIZE = "1rem"

const SpeechBalloon = React.forwardRef<HTMLDivElement, SpeechBalloonProps>(
  ({ children, className, onClick }, ref) => {
    const bg = baseTheme.colors.gray[100]

    const outerCss = css`
      display: flex;
      flex-direction: column;
      align-items: center;
      width: max-content;
    `
    return (
      <div
        ref={ref}
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
  },
)

// eslint-disable-next-line i18next/no-literal-string
SpeechBalloon.displayName = "SpeechBalloon"
export default SpeechBalloon
