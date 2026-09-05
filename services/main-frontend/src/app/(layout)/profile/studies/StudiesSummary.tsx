"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { MyStudiesTotals } from "@/generated/api/types.generated"
import { StatTile, StatTileList } from "@/shared-module/components"

export interface StudiesSummaryProps {
  totals: MyStudiesTotals
}

const listCss = css`
  margin-bottom: 0.5rem;
`

/** ECTS can be fractional, but a whole number should not read as "5.0". */
const formatEcts = (ects: number, locale: string): string =>
  ects.toLocaleString(locale, { maximumFractionDigits: 1 })

const StudiesSummary: React.FC<StudiesSummaryProps> = ({ totals }) => {
  const { t, i18n } = useTranslation()

  return (
    <StatTileList ariaLabel={t("heading-summary")} className={listCss}>
      <StatTile label={t("stat-completions")} value={totals.completions} />
      <StatTile label={t("stat-ects-earned")} value={formatEcts(totals.ects, i18n.language)} />
    </StatTileList>
  )
}

export default StudiesSummary
