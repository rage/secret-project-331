import { css } from "@emotion/css"
import React from "react"

interface NoSidebar {
  sidebar: false
}

interface WithSidebar {
  sidebar: true
  sidebarPosition: "left" | "right"
  sidebarWidth: string
}

export type BreakFromCenteredProps = NoSidebar | WithSidebar

const commonStyles = css`
  position: relative;
  left: 50%;
  right: 50%;
`

const BreakFromCentered: React.FC<BreakFromCenteredProps> = (props) => {
  if (props.sidebar) {
    if (props.sidebarPosition === "left") {
      return (
        <div
          className={css`
            ${commonStyles}
            width: calc(100vw - ${props.sidebarWidth});
            margin-left: calc(-50vw + ${props.sidebarWidth} / 2);
            margin-right: calc(-50vw + ${props.sidebarWidth} / 2);
          `}
        >
          {props.children}
        </div>
      )
    } else {
      return (
        <div
          className={css`
            ${commonStyles}
            width: calc(100vw - ${props.sidebarWidth});
            margin-left: calc(-50vw + ${props.sidebarWidth} / 2);
            margin-right: calc(-50vw + ${props.sidebarWidth} / 2);
          `}
        >
          {props.children}
        </div>
      )
    }
  }
  return (
    <div
      className={css`
        ${commonStyles}
        width: 100vw;
        margin-left: -50vw;
        margin-right: -50vw;
      `}
    >
      {props.children}
    </div>
  )
}

export default BreakFromCentered
