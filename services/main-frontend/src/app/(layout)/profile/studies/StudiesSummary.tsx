"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { noteCss } from "@/components/credit-registration/styles"
import type { MyStudiesTotals } from "@/generated/api/types.generated"

export interface StudiesSummaryProps {
  totals: MyStudiesTotals
}

/** ECTS can be fractional, but a whole number should not read as "5.0". */
const formatEcts = (ects: number, locale: string): string =>
  ects.toLocaleString(locale, { maximumFractionDigits: 1 })

const StudiesSummary: React.FC<StudiesSummaryProps> = ({ totals }) => {
  const { t, i18n } = useTranslation()

  return (
    <p className={noteCss}>
      {t("studies-summary-completions-and-ects", {
        completions: totals.completions,
        ects: formatEcts(totals.ects, i18n.language),
      })}
    </p>
  )
}

export default StudiesSummary
