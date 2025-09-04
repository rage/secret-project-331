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
  opacity: 1;
  z-index: 2;
  position: absolute;
  top: 20px;
  left: 50%;
  border-radius: 3px;
  min-width: 400px;
  transition:
    visibility 0s linear 100ms,
    opacity 100ms;
  box-shadow: rgba(0, 0, 0, 0.1) 0 2px 10px;
`

const TooltipText = styled.span`
  color: #313947;
  border: 1px solid #e2e4e6;
  border-radius: 3px;
  font-family: "Inter", sans-serif;
  font-size: 14px;
  background: #f9f9f9;
  padding: 0 5px;
`

const TooltipNTrigger: React.FC<TooltipNTriggerProps> = ({ reference }) => {
  if (reference) {
    return (
      <TooltipTrigger delay={200} closeDelay={200}>
        <sup>
          <Anchor href="#ref-1">[1]</Anchor>
        </sup>
        <Tooltip>
          <TooltipBox>
            <TooltipText>{reference.text}</TooltipText>
          </TooltipBox>
        </Tooltip>
      </TooltipTrigger>
    )
  }
}

export default TooltipNTrigger
