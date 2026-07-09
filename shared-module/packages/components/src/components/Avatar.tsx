"use client"

import { css, cx } from "@emotion/css"
import React from "react"

export interface AvatarProps {
  /** Full name; initials are derived from it and it seeds the background colour. */
  name: string
  /** Diameter in pixels. */
  size?: number
  className?: string
}

// Decorative monogram; the name is shown as text alongside, so this is aria-hidden.
const AVATAR_COLORS = [
  "var(--color-blue-600)",
  "var(--color-green-600)",
  "var(--color-purple-600)",
  "var(--color-crimson-600)",
  "var(--color-gray-600)",
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return "?"
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

const rootCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 50%;
  color: var(--color-primary-100);
  font-weight: 700;
  text-transform: uppercase;
  user-select: none;
`

export const Avatar: React.FC<AvatarProps> = ({ name, size = 48, className }) => {
  const sizeCss = css`
    width: ${size}px;
    height: ${size}px;
    background: ${AVATAR_COLORS[hash(name) % AVATAR_COLORS.length]};
    font-size: ${Math.round(size * 0.38)}px;
  `
  return (
    <span className={cx(rootCss, sizeCss, className)} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
