"use client"

import { cx } from "@emotion/css"
import React from "react"

import { popoverCss } from "./selectStyles"

export type PopoverProps = React.PropsWithChildren<{
  className?: string
}>

export function Popover({ children, className }: PopoverProps) {
  return <div className={cx(popoverCss, className)}>{children}</div>
}
