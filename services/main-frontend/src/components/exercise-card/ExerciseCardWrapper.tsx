"use client"

import { css } from "@emotion/css"
import React from "react"

export interface ExerciseCardWrapperProps {
  children: React.ReactNode
  id?: string
  ariaLabelledby?: string
}

/** Outer gray rounded card that wraps an entire exercise. */
const ExerciseCardWrapper = React.forwardRef<HTMLElement, ExerciseCardWrapperProps>(
  ({ children, id, ariaLabelledby }, ref) => (
    <section
      ref={ref}
      id={id}
      aria-labelledby={ariaLabelledby}
      className={css`
        width: 100%;
        background: #f2f2f2;
        border-radius: 1rem;
        margin-bottom: 1rem;
        padding-bottom: 1.25rem;
        position: relative;
      `}
    >
      {children}
    </section>
  ),
)

ExerciseCardWrapper.displayName = "ExerciseCardWrapper"

export default ExerciseCardWrapper
