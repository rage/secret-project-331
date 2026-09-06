"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { MyStudiesTotals } from "@/generated/api/types.generated"
import { StatTile, StatTileList } from "@/shared-module/components"

export interface StudiesSummaryProps {
  totals: MyStudiesTotals
}

/** ECTS can be fractional, but a whole number should not read as "5.0". */
const formatEcts = (ects: number, locale: string): string =>
  ects.toLocaleString(locale, { maximumFractionDigits: 1 })

const SUMMARY_TILE_COUNT = 2

/**
 * How much the student has earned so far: the number a finishing student came to the page for.
 *
 * Renders nothing before the first completion — a row of zeros answers a question nobody asked and
 * pushes the courses that would answer it off the screen.
 */
const StudiesSummary: React.FC<StudiesSummaryProps> = ({ totals }) => {
  const { t, i18n } = useTranslation()

  if (totals.completions === 0 && totals.ects === 0) {
    return null
  }

  return (
    <StatTileList
      ariaLabel={t("heading-my-studies")}
      maxColumns={SUMMARY_TILE_COUNT}
      size="compact"
    >
      <StatTile
        label={t("label-credits-earned")}
        value={t("ects-n", { n: formatEcts(totals.ects, i18n.language) })}
      />
      <StatTile label={t("label-course-parts-completed")} value={totals.completions} />
    </StatTileList>
  )
}

export default StudiesSummary
