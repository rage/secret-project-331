import styled from "@emotion/styled"
import { ReactNode, useRef } from "react"
import { useLink } from "react-aria"

const StyledAnchor = styled.a`
  text-decoration: none;

  &:focus {
    text-decoration: underline;
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
