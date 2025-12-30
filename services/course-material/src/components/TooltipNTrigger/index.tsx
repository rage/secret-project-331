import GlossaryTriggerNPopover from "./GlossaryTriggerNPopover"
import { TooltipBox } from "./TooltipBox"
import { TooltipNTriggerAnchor } from "./TooltipNTriggerAnchor"

import { css } from "@emotion/css"
import React, { ReactNode } from "react"
import { Tooltip, TooltipTrigger } from "react-aria-components"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()
  const { children, tooltipContent } = props

  if (props.variant === "references") {
    return (
      <TooltipTrigger delay={200} closeDelay={200}>
        <sup
          className={css`
            /** This is to make the superscript not to change line spacing **/
            line-height: 0;
            display: inline-block;
          `}
        >
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
