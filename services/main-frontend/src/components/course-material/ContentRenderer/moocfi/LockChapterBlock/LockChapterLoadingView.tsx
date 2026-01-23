"use client"

import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "@/shared-module/common/styles"

const skeletonPulse = css`
  @keyframes pulse {
    0%,
    100% {
      background-color: ${baseTheme.colors.gray[200]};
    }
    50% {
      background-color: ${baseTheme.colors.gray[300]};
    }
  }

  animation: pulse 1.5s ease-in-out infinite;
`

const LockChapterLoadingView: React.FC = () => {
  return (
    <div
      className={css`
        background: ${baseTheme.colors.clear[100]};
        border: 1px solid ${baseTheme.colors.gray[300]};
        border-radius: 8px;
        padding: 2.5rem 2rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      `}
    >
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 1rem;
        `}
      >
        <div
          className={css`
            width: 32px;
            height: 32px;
            border-radius: 4px;
            ${skeletonPulse}
          `}
        />
        <div
          className={css`
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          `}
        >
          <div
            className={css`
              height: 20px;
              border-radius: 4px;
              width: 60%;
              ${skeletonPulse}
            `}
          />
          <div
            className={css`
              height: 16px;
              border-radius: 4px;
              width: 80%;
              ${skeletonPulse}
            `}
          />
        </div>
      </div>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        `}
      >
        <div
          className={css`
            height: 16px;
            border-radius: 4px;
            ${skeletonPulse}
          `}
        />
        <div
          className={css`
            height: 16px;
            border-radius: 4px;
            width: 90%;
            ${skeletonPulse}
          `}
        />
        <div
          className={css`
            height: 16px;
            border-radius: 4px;
            width: 75%;
            ${skeletonPulse}
          `}
        />
      </div>
    </div>
  )
}

export default LockChapterLoadingView
