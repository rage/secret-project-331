/* eslint-disable i18next/no-literal-string */
"use client"

import { css } from "@emotion/css"
import React from "react"
import { Link as AriaLink, Tooltip, TooltipTrigger } from "react-aria-components"

const Brand: React.FC = () => {
  return (
    <TooltipTrigger>
      <AriaLink
        href="/"
        aria-label="Go to home"
        className={css`
          display: inline-flex;
          align-items: center;
          gap: 8px;
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
        <div
          className={css`
            width: 26px;
            height: 26px;
            display: grid;
            place-items: center;
            border-radius: 6px;
            background: #111827;
            color: white;
            font-weight: 700;
            font-size: 10px;
          `}
        >
          SP
        </div>
        <span
          className={css`
            font-size: 14px;
            font-weight: 600;
            color: #111827;
          `}
        >
          Secret Project 331
        </span>
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
