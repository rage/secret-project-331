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
    <div data-expanded={state.isExpanded || undefined}>
      <div {...panelProps} ref={panelRef} className={reactAriaDisclosurePanel}>
        <div>{children}</div>
      </div>
    </div>
  )
}

export default SidebarDisclosure
