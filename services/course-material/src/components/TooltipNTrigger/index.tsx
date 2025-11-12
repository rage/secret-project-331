import { t } from "i18next"
import React, { ReactNode } from "react"
import { Tooltip, TooltipTrigger } from "react-aria-components"

import { TooltipBox } from "./TooltipBox"
import { TooltipNTriggerAnchor } from "./TooltipNTriggerAnchor"
import { UnderlinedWithPopover } from "./UnderlinedWithPopover"

type TooltipNTriggerProps =
  | {
      variant: "references"
      href: string
      children: ReactNode
      tooltipContent: ReactNode
    }
  | {
      variant?: "glossary"
      children: ReactNode
      tooltipContent: ReactNode
      className?: string
    }

const TooltipNTrigger: React.FC<TooltipNTriggerProps> = (props) => {
  const { children, tooltipContent } = props

  if (props.variant === "references") {
    return (
      <TooltipTrigger delay={200} closeDelay={200}>
        <sup>
          <TooltipNTriggerAnchor href={props.href}>{children}</TooltipNTriggerAnchor>
        </sup>
        <Tooltip>
          <TooltipBox>{tooltipContent}</TooltipBox>
        </Tooltip>
      </TooltipTrigger>
    )
  }

  return (
    <UnderlinedWithPopover
      className={props.className}
      tooltipContent={tooltipContent}
      dialogAriaLabel={t("term-explanation")}
    >
      {children}
    </UnderlinedWithPopover>
  )
}

export default TooltipNTrigger
