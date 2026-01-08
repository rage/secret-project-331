/* eslint-disable i18next/no-literal-string */
"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { Link as AriaLink, Tooltip, TooltipTrigger } from "react-aria-components"

import MOOCfi from "@/shared-module/common/img/moocfiLogo.svg"

const StyledIcon = css`
  font-size: 1.8rem;

  path {
    color: #4b5563 !important;
  }
`

const Brand: React.FC = () => {
  return (
    <TooltipTrigger>
      <AriaLink
        href="/"
        aria-label="Go to home"
        className={css`
          display: inline-flex;
          align-items: center;
          border-radius: 12px;
          padding: 8px 10px; /* slightly larger target */
          outline: none;
          transition: background 120ms ease;
          text-decoration: none;

          &:hover,
          &[data-hovered] {
            background: #f3f4f6;
          }
          &[data-focus-visible] {
            box-shadow: 0 0 0 2px #111827;
          }
        `}
      >
        <MOOCfi className={cx(StyledIcon)} />
      </AriaLink>
      <Tooltip
        className={css`
          background: #111827;
          color: #fff;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
        `}
      >
        Home
      </Tooltip>
    </TooltipTrigger>
  )
}

export default Brand
