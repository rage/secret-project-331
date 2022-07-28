import { css } from "@emotion/css"
import React from "react"

interface NoSidebar {
  sidebar: false
}

export interface WithSidebar {
  sidebar: true
  sidebarPosition: "left" | "right"
  sidebarWidth: string
  sidebarThreshold?: string
}

export type BreakFromCenteredProps = NoSidebar | WithSidebar

const BreakFromCentered: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<BreakFromCenteredProps>>
> = (props) => {
  // 100vw unfortunately does not take into account the scrollbar width, so we need to calculate its width and substract it from the width of the page
  let scrollbarWidth = 0
  if (typeof window !== "undefined") {
    scrollbarWidth = Math.abs(window.innerWidth - document.documentElement.clientWidth) / 2
  }
  if (props.sidebar) {
    if (props.sidebarThreshold) {
      return (
        <div
          className={css`
            position: relative;
            left: 50%;
            right: 50%;
            margin-left: calc(-50vw + ${props.sidebarWidth} / 2);
            margin-right: calc(-50vw + ${props.sidebarWidth} / 2);
            width: calc(100vw - ${props.sidebarWidth} - ${scrollbarWidth}px);

            @media (max-width: ${props.sidebarThreshold}) {
              margin-left: -50vw;
              margin-right: -50vw;
              width: calc(100vw - ${scrollbarWidth}px);
            }
          `}
        >
          {props.children}
        </div>
      )
    } else {
      return (
        <div
          className={css`
            position: relative;
            left: 50%;
            right: 50%;
            margin-left: calc(-50vw + ${props.sidebarWidth} / 2);
            margin-right: calc(-50vw + ${props.sidebarWidth} / 2);
            width: calc(100vw - ${props.sidebarWidth} - ${scrollbarWidth}px);
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
        position: relative;
        left: 50%;
        right: 50%;
        margin-left: -50vw;
        margin-right: -50vw;
        width: calc(100vw - ${scrollbarWidth}px);
      `}
    >
      {props.children}
    </div>
  )
}

export default BreakFromCentered
