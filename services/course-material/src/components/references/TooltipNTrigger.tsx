import styled from "@emotion/styled"
import { Link, Tooltip, TooltipTrigger } from "react-aria-components"

import { Reference } from "."

interface TooltipNTriggerProps {
  reference: Reference | undefined
}

const Anchor = styled(Link)`
  text-decoration: none;

  &:focus {
    text-decoration: underline;
  }
  ,
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
  border: 1px solid #e2e4e6;
  padding: 0 5px;
  color: #313947;
  font-family: "Inter", sans-serif;
  font-size: 14px;
`

const TooltipNTrigger: React.FC<TooltipNTriggerProps> = ({ reference }) => {
  if (reference) {
    return (
      <TooltipTrigger delay={200} closeDelay={200}>
        <sup>
          <Anchor href="#ref-1">[1]</Anchor>
        </sup>
        <Tooltip>
          <TooltipBox>{reference.text}</TooltipBox>
        </Tooltip>
      </TooltipTrigger>
    )
  }
}

export default TooltipNTrigger
