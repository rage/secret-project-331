import styled from "@emotion/styled"
import { Link, Tooltip, TooltipTrigger } from "react-aria-components"

import { Reference } from "."

import { baseTheme, primaryFont } from "@/shared-module/common/styles"

interface TooltipNTriggerProps {
  reference: Reference | undefined
  citeNumber: number
}

const Anchor = styled(Link)`
  text-decoration: none;

  &:focus {
    text-decoration: underline;
  }

  &:hover {
    text-decoration: underline;
  }
`

const TooltipBox = styled.div`
  border-radius: 3px;
  min-width: 200px;
  max-width: 400px;
  box-shadow: rgba(0, 0, 0, 0.1) 0 2px 10px;
  background: #f9f9f9;
  border: 1px solid ${baseTheme.colors.clear[300]};
  padding: 0 5px;
  color: ${baseTheme.colors.gray[600]};
  font-family: ${primaryFont};
  font-size: 14px;
`

const TooltipNTrigger: React.FC<TooltipNTriggerProps> = ({ reference, citeNumber }) => {
  if (reference) {
    return (
      <TooltipTrigger delay={200} closeDelay={200}>
        <sup>
          <Anchor href={"#ref-" + citeNumber}>[{citeNumber}]</Anchor>
        </sup>
        <Tooltip>
          <TooltipBox>{reference.text}</TooltipBox>
        </Tooltip>
      </TooltipTrigger>
    )
  }
  return null
}

export default TooltipNTrigger
