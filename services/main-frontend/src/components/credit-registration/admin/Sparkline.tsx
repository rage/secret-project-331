"use client"

import { css } from "@emotion/css"
import React from "react"

interface Props {
  points: number[]
  /** Read out instead of the shape, which assistive tech cannot see. */
  ariaLabel: string
}

const WIDTH = 120
const HEIGHT = 24

const rootCss = css`
  display: block;
  color: var(--color-gray-500);
`

/**
 * Shape only, next to the number that carries the value. Hand-rolled rather than a chart instance: it
 * is a polyline, and the table below it is the source of truth.
 */
const Sparkline: React.FC<Props> = ({ points, ariaLabel }) => {
  if (points.length < 2) {
    return null
  }
  const max = Math.max(...points, 1)
  const step = WIDTH / (points.length - 1)
  const path = points
    .map((point, index) => {
      const x = (index * step).toFixed(1)
      const y = (HEIGHT - (point / max) * HEIGHT).toFixed(1)
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      className={rootCss}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  )
}

export default Sparkline
