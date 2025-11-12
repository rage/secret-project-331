import styled from "@emotion/styled"
import { ReactNode } from "react"
import { Button as ReactAriaButton, Tooltip, TooltipTrigger } from "react-aria-components"

import { TooltipNTriggerAnchor } from "./TooltipNTriggerAnchor"

import { baseTheme, primaryFont } from "@/shared-module/common/styles"

// eslint-disable-next-line i18next/no-literal-string
const StyledButton = styled(ReactAriaButton)`
  text-decoration: underline;
  border: none;
  background: none;
  padding: 2px 4px;
  margin: -2px -4px;
  cursor: help;
  border-radius: 2px;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: ${baseTheme.colors.clear[100]};
  }

  &:focus {
    outline: 2px solid ${baseTheme.colors.blue[500]};
    outline-offset: 2px;
    background-color: ${baseTheme.colors.clear[100]};
  }
`

export const TooltipBox = styled.div`
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

type TooltipNTriggerProps =
  | {
      variant: "sup-footnote"
      href: string
      children: ReactNode
      tooltipContent: ReactNode
    }
  | {
      variant?: "underlined-text"
      children: ReactNode
      tooltipContent: ReactNode
      className?: string
    }

const TooltipNTrigger: React.FC<TooltipNTriggerProps> = (props) => {
  const { children, tooltipContent } = props

  return (
    <TooltipTrigger delay={200} closeDelay={200}>
      {props.variant === "sup-footnote" ? (
        <sup>
          <TooltipNTriggerAnchor href={props.href}>{children}</TooltipNTriggerAnchor>
        </sup>
      ) : (
        <StyledButton className={props.className}>{children}</StyledButton>
      )}
      <Tooltip>
        <TooltipBox>{tooltipContent}</TooltipBox>
      </Tooltip>
    </TooltipTrigger>
  )
}

export default TooltipNTrigger
