"use client"

import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "@/shared-module/common/styles"

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid ${baseTheme.colors.clear[300]};
        &:last-of-type {
          border-bottom: none;
        }
      `}
    >
      <span
        className={css`
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: ${baseTheme.colors.gray[500]};
        `}
      >
        {label}
      </span>
      <span
        className={css`
          font-size: 0.9rem;
          color: ${baseTheme.colors.gray[700]};
        `}
      >
        {value}
      </span>
    </div>
  )
}

export default DetailRow
