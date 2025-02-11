import { css } from "@emotion/css"
import React, { useContext } from "react"

interface NoSidebar {
  sidebar: false
}

export interface WithSidebar {
  sidebar: true
  sidebarPosition: "left" | "right"
  sidebarWidth: string
  sidebarThreshold?: string
}

/**
 * Context to disable the BreakFromCentered component when the content is inside a container
 * that should not break out of its bounds, such as exercise blocks.
 */
export const BreakFromCenteredDisabledContext = React.createContext<boolean>(false)

export type BreakFromCenteredProps = NoSidebar | WithSidebar

/**
 * BreakFromCentered component allows content to extend beyond the centered container.
 *
 * In our layout, content is wrapped in a container with a constrained width and centered using auto margins.
 * This ensures that most content is neatly centered. However, there are cases where you need elements
 * that span the full width of the browser window, exceeding the container's width.
 *
 * Use BreakFromCentered to achieve this full-width effect. When using this component, you are responsible
 * for handling the centering of the content within it.
 *
 * **Props:**
 * - `sidebar`: Determines if a sidebar is present.
 *   - When `true`, additional props like `sidebarPosition`, `sidebarWidth`, and `sidebarThreshold` are required.
 *
 * You can disable the BreakFromCentered behavior by using the `BreakFromCenteredDisabledContext` in a parent component.
 *
 * @param props - The properties for configuring the BreakFromCentered component.
 * @returns A React component that allows content to break out of the centered container.
 */
const BreakFromCentered: React.FC<
  React.PropsWithChildren<BreakFromCenteredProps>
> = (props) => {
  const disabled = useContext(BreakFromCenteredDisabledContext)
  if (disabled) {
    return <>{props.children}</>
  }
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
