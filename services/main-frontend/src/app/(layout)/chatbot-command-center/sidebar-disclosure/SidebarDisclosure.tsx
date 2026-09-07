"use client"

import { css } from "@emotion/css"
import type { DisclosureState } from "@react-stately/disclosure"
import React from "react"
import type { ReactNode } from "react"
import type { AriaDisclosureProps } from "react-aria"

interface DisclosureProps extends AriaDisclosureProps {
  children?: ReactNode
  state: DisclosureState
  panelProps: React.HTMLAttributes<HTMLElement>
  panelRef: React.RefObject<HTMLDivElement | null>
}

const reactAriaDisclosure = css`
  @media (max-width: 767.98px) {
    display: none !important;
  }
`

const reactAriaDisclosurePanel = css`
  display: grid;
  grid-template-columns: 1fr;
  opacity: 1;
  visibility: visible;
  overflow: hidden;
  transition:
    grid-template-columns 0.2s linear,
    opacity 0.2s linear,
    visibility 0.2s linear allow-discrete;

  &[aria-hidden="true"] {
    grid-template-columns: 0fr;
    opacity: 0;
    visibility: hidden;

    transition: none;
  }
`

const SidebarDisclosure: React.FC<DisclosureProps> = ({
  state,
  panelProps,
  panelRef,
  children,
}) => {
  return (
    <div className={reactAriaDisclosure} data-expanded={state.isExpanded || undefined}>
      <div
        className={css`
          display: flex;
          align-items: baseline;
          justify-content: space-between;

          flex-direction: ${!state.isExpanded ? "column-reverse" : "row"};
        `}
      >
        <div
          className={css`
            display: flex;
            flex-direction: ${!state.isExpanded ? "column" : "row"};
            align-items: center;
          `}
        ></div>
      </div>
      <div {...panelProps} ref={panelRef} className={reactAriaDisclosurePanel}>
        <div>{children}</div>
      </div>
    </div>
  )
}

export default SidebarDisclosure
