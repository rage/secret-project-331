"use client"

import { css } from "@emotion/css"
import React from "react"
import { Tooltip, TooltipTrigger } from "react-aria-components"

interface ClarificationTooltipProps {
  children: React.ReactNode
  text: string
  offset?: number
}

const ClarificationTooltip: React.FC<ClarificationTooltipProps> = ({
  children,
  text,
  offset = 8,
}) => {
  return (
    <TooltipTrigger>
      {children}
      <Tooltip
        offset={offset}
        className={css`
          background: #111827;
          color: #fff;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          max-width: 200px;
        `}
      >
        {text}
      </Tooltip>
    </TooltipTrigger>
  )
}

export default ClarificationTooltip
