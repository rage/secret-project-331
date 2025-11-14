import { t } from "i18next"
import React, { ReactNode } from "react"
import { Tooltip, TooltipTrigger } from "react-aria-components"

import GlossaryTriggerNPopover from "./GlossaryTriggerNPopover"
import { TooltipBox } from "./TooltipBox"
import { TooltipNTriggerAnchor } from "./TooltipNTriggerAnchor"

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
    <GlossaryTriggerNPopover
      className={props.className}
      tooltipContent={tooltipContent}
      dialogAriaLabel={t("definition")}
    >
      {children}
    </GlossaryTriggerNPopover>
  )
}

export default TooltipNTrigger
