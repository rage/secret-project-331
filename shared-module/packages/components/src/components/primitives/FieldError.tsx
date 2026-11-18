"use client"

import React from "react"

type FieldErrorProps = React.HTMLAttributes<HTMLElement> & {
  inline?: boolean
  children: React.ReactNode
}

/**
 * Field error text. Not a live region: the input points at it via aria-describedby and
 * aria-invalid, and the form focuses the first invalid field, so errors are read in context.
 */
export function FieldError({ inline, children, ...rest }: FieldErrorProps) {
  return inline ? <span {...rest}>{children}</span> : <p {...rest}>{children}</p>
}
