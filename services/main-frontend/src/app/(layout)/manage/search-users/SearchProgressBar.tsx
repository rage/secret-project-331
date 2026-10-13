"use client"

import { css, keyframes } from "@emotion/css"
import { motion, useReducedMotion } from "motion/react"
import React from "react"
import { useTranslation } from "react-i18next"

const beam = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
`

const slotCss = css`
  position: relative;
  height: 3px;
  margin: var(--space-2) 0 var(--space-3);
  overflow: hidden;
  border-radius: 999px;
`

const fillCss = css`
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  background: var(--color-green-600);
  transform-origin: left center;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    width: 40%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
    animation: ${beam} var(--query-progress-beam-duration) linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
    }
  }
`

/** Never reaches the end on its own, so a slow search still looks alive without claiming done. */
const CREEP_TARGET = 0.9
const CREEP_DURATION_S = 6
const CREEP_EASE = [0.15, 0.6, 0.3, 1] as const
const EASE_OUT = "easeOut" as const

export interface SearchProgressBarProps {
  isSearching: boolean
  /** Changes with every new search, so the bar restarts from empty. */
  searchKey: string
}

/** Thin indeterminate bar in a fixed-height slot, so showing and hiding it never moves the page. */
const SearchProgressBar: React.FC<SearchProgressBarProps> = ({ isSearching, searchKey }) => {
  const { t } = useTranslation()
  const shouldReduceMotion = !!useReducedMotion()

  return (
    <div className={slotCss}>
      <motion.div
        key={searchKey}
        role={isSearching ? "progressbar" : undefined}
        aria-label={isSearching ? t("search-users-progress-label") : undefined}
        aria-hidden={!isSearching}
        className={fillCss}
        initial={isSearching ? { scaleX: 0, opacity: 1 } : false}
        animate={
          isSearching
            ? {
                scaleX: CREEP_TARGET,
                opacity: 1,
                transition: {
                  duration: shouldReduceMotion ? 0 : CREEP_DURATION_S,
                  ease: CREEP_EASE,
                },
              }
            : {
                scaleX: 1,
                opacity: 0,
                transition: {
                  scaleX: { duration: shouldReduceMotion ? 0 : 0.18, ease: EASE_OUT },
                  opacity: { duration: shouldReduceMotion ? 0 : 0.2, delay: 0.15 },
                },
              }
        }
      />
    </div>
  )
}

export default SearchProgressBar
