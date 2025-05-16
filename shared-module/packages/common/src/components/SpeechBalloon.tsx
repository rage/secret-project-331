import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "../styles"
import { runCallbackIfEnterPressed } from "../utils/accessibility"

export interface SpeechBalloonProps {
  className?: string
  onClick?: () => void
  children?: React.ReactNode
}

const BORDER_RADIUS = "8px"
const BORDER_WIDTH = "2px"
const POINTER_SIZE = "12px"

// Clean white background with green accents
const COLORS = {
  bg: "#ffffff",
  border: baseTheme.colors.green[400],
  text: baseTheme.colors.gray[700],
  shadow: "rgba(0, 0, 0, 0.4)",
}

const SpeechBalloon = React.forwardRef<HTMLDivElement, SpeechBalloonProps>(
  ({ children, className, onClick }, ref) => {
    const speechBalloonCss = css`
      display: inline-block;
      position: relative;
      background: ${COLORS.bg};
      color: ${COLORS.text};
      padding: 1rem 1.5rem;
      border-radius: ${BORDER_RADIUS};
      border: ${BORDER_WIDTH} solid ${COLORS.border};
      box-shadow: 0 3px 15px 0px ${COLORS.shadow};
      margin-bottom: ${POINTER_SIZE};
      transition: filter 0.3s;
      width: max-content;

      &:active {
        transform: translateY(0);
      }

      ${onClick &&
      `
        cursor: pointer;

        &:hover {
          filter: brightness(0.9);
        }
      `}

      &:after {
        content: "";
        position: absolute;
        bottom: -${POINTER_SIZE};
        left: calc(50% - ${POINTER_SIZE});
        width: 0;
        height: 0;
        border-left: ${POINTER_SIZE} solid transparent;
        border-right: ${POINTER_SIZE} solid transparent;
        border-top: ${POINTER_SIZE} solid ${COLORS.border};
        filter: drop-shadow(0 8px 6px ${COLORS.shadow});
      }

      &:before {
        content: "";
        position: absolute;
        bottom: calc(-${POINTER_SIZE} + ${BORDER_WIDTH} * 1.5);
        left: calc(50% - ${POINTER_SIZE} + ${BORDER_WIDTH});
        width: 0;
        height: 0;
        border-left: calc(${POINTER_SIZE} - ${BORDER_WIDTH}) solid transparent;
        border-right: calc(${POINTER_SIZE} - ${BORDER_WIDTH}) solid transparent;
        border-top: calc(${POINTER_SIZE} - ${BORDER_WIDTH} * 1.5) solid ${COLORS.bg};
        z-index: 1;
      }
    `

    return (
      <div
        ref={ref}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => onClick && runCallbackIfEnterPressed(e, onClick)}
        onClick={onClick}
        className={`${speechBalloonCss} ${className ?? ""}`}
      >
        {children}
      </div>
    )
  },
)

SpeechBalloon.displayName = "SpeechBalloon"
export default SpeechBalloon
