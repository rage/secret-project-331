"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { MyStudiesTotals } from "@/generated/api/types.generated"
import { StatTile } from "@/shared-module/components"

export interface StudiesSummaryProps {
  totals: MyStudiesTotals
}

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0 0 1.5rem;
`

/** ECTS can be fractional, but a whole number should not read as "5.0". */
const formatEcts = (ects: number, locale: string): string =>
  ects.toLocaleString(locale, { maximumFractionDigits: 1 })

const StudiesSummary: React.FC<StudiesSummaryProps> = ({ totals }) => {
  const { t, i18n } = useTranslation()

  return (
    <div className={rowCss}>
      <StatTile label={t("stat-courses")} value={totals.courses} />
      <StatTile label={t("stat-completions")} value={totals.completions} />
      <StatTile label={t("stat-ects-earned")} value={formatEcts(totals.ects, i18n.language)} />
    </div>
  )
}

export default StudiesSummary
