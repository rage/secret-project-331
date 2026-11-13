"use client"

import { css, cx } from "@emotion/css"
import React, { useEffect, useRef, useState } from "react"

import { DURATION_MS } from "../styles/motion"

export interface RevealProps {
  isOpen: boolean
  children: React.ReactNode
  /** Lands on the content wrapper, inside the clipping box, so padding collapses with it. */
  className?: string
  /** Lands on the outer, animated box: e.g. to set `--reveal-collapsed-margin-top`. */
  rootClassName?: string
  "data-testid"?: string | undefined
}

/*
 * Animating grid-template-rows between 0fr and 1fr sizes the box to its content whatever its
 * height, without measuring it. The root stays mounted while closed so the next opening has a
 * collapsed state to transition from.
 *
 * `--reveal-collapsed-margin-top`, set through `rootClassName`, cancels the flex or grid `gap` a
 * closed Reveal would otherwise still occupy in its parent.
 */
const rootCss = css`
  display: grid;
  grid-template-rows: 0fr;
  margin-top: var(--reveal-collapsed-margin-top, 0px);
  opacity: 0;
  transform: translateY(-4px);
  visibility: hidden;
  transition:
    grid-template-rows var(--duration-base) var(--ease-standard),
    margin-top var(--duration-base) var(--ease-standard),
    opacity var(--duration-base) var(--ease-standard),
    transform var(--duration-base) var(--ease-standard),
    visibility 0s linear var(--duration-base);

  &[data-open="true"] {
    grid-template-rows: 1fr;
    margin-top: 0;
    opacity: 1;
    transform: none;
    visibility: visible;
    transition-delay: 0s;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const clipCss = css`
  min-height: 0;
  overflow: hidden;

  /* Unclipped once settled, so focus rings and shadows inside are not cut off. */
  [data-settled="true"] > & {
    overflow: visible;
  }
`

/**
 * Shows or hides content with a short height, fade and slide transition (none under
 * `prefers-reduced-motion`). Closed content is unmounted once the transition ends, so fields inside
 * it drop out of the form and focus order.
 *
 * For a user-toggled section with a trigger, use `Disclosure` instead.
 */
export const Reveal: React.FC<RevealProps> = ({
  isOpen,
  children,
  className,
  rootClassName,
  "data-testid": dataTestId,
}) => {
  const [isRendered, setIsRendered] = useState(isOpen)
  const [isSettled, setIsSettled] = useState(isOpen)
  const isFirstRun = useRef(true)

  if (isOpen && !isRendered) {
    setIsRendered(true)
  }

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    setIsSettled(false)
    const timer = setTimeout(() => {
      if (isOpen) {
        setIsSettled(true)
      } else {
        setIsRendered(false)
      }
    }, DURATION_MS.base)
    return () => clearTimeout(timer)
  }, [isOpen])

  return (
    <div
      className={cx(rootCss, rootClassName)}
      data-open={isOpen}
      data-settled={isOpen && isSettled}
      inert={!isOpen}
      data-testid={dataTestId}
    >
      <div className={clipCss}>
        {isRendered ? <div className={className}>{children}</div> : null}
      </div>
    </div>
  )
}
