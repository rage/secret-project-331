"use client"

import styled from "@emotion/styled"
import type { ReactNode } from "react"

import { focusProgrammatically } from "@/shared-module/components"

const StyledAnchor = styled.a`
  text-decoration: none;
  line-height: normal;
  display: inline-block;

  &:focus {
    text-decoration: underline;
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  &:hover {
    text-decoration: underline;
  }
`

interface TooltipNTriggerAnchorProps {
  href?: string | undefined
  children: ReactNode
}

// Opens the enclosing References <details>, then scrolls to and focuses the target item.
const openAndFocusReference = (href: string) => {
  const target = document.querySelector<HTMLElement>(`#${CSS.escape(href.replace(/^#/, ""))}`)
  if (!target) {
    return
  }
  const details = target.closest("details")
  if (details) {
    details.open = true
  }
  // oxlint-disable-next-line i18next/no-literal-string
  target.scrollIntoView?.({ block: "center" })
  focusProgrammatically(target)
}

export const TooltipNTriggerAnchor: React.FC<TooltipNTriggerAnchorProps> = ({ href, children }) => {
  if (!href) {
    // Unresolved citation: no target, so not a link; focusable so the tooltip is reachable.
    return (
      // oxlint-disable-next-line i18next/no-literal-string
      <StyledAnchor as="span" tabIndex={0}>
        {children}
      </StyledAnchor>
    )
  }
  return (
    <StyledAnchor
      href={href}
      role="doc-noteref"
      onClick={(e) => {
        e.preventDefault()
        openAndFocusReference(href)
      }}
    >
      {children}
    </StyledAnchor>
  )
}
