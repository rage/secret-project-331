"use client"

import styled from "@emotion/styled"
import { ReactNode, useRef } from "react"
import { useLink } from "react-aria"

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
  href: string
  children: ReactNode
}

export const TooltipNTriggerAnchor: React.FC<TooltipNTriggerAnchorProps> = ({ href, children }) => {
  const linkRef = useRef<HTMLAnchorElement>(null)
  const { linkProps } = useLink({ href }, linkRef)

  return (
    <StyledAnchor {...linkProps} href={href} ref={linkRef} role="doc-noteref">
      {children}
    </StyledAnchor>
  )
}
