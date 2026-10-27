"use client"

import { css } from "@emotion/css"
import React from "react"

const courseCodeCss = css`
  font-weight: 600;
  letter-spacing: 0.02em;
`

/** A Sisu course code, for a `Trans` component slot: set apart so it reads as the thing to look for. */
export const SisuCourseCode: React.FC<{ code: string }> = ({ code }) => (
  <span className={courseCodeCss}>{code}</span>
)
