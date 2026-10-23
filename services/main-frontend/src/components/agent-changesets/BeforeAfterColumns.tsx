"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const columnHeadingCss = css`
  font-size: 0.875rem;
  font-weight: ${fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: ${baseTheme.colors.gray[500]};
  margin: 0 0 0.5rem 0;
`

const columnCss = css`
  min-width: 0;
  border: 1px solid ${baseTheme.colors.gray[100]};
  border-radius: 8px;
  padding: 1rem;
  background: white;
  overflow: hidden;
`

interface BeforeAfterColumnsProps {
  /** Left out when there was nothing before, as for a created entity. */
  before?: React.ReactNode
  /** Left out when there is nothing after, as for a deleted entity. */
  after?: React.ReactNode
  "data-testid-prefix": string
}

/** Content before and after a change in two bordered columns, stacked on narrow screens. */
const BeforeAfterColumns: React.FC<BeforeAfterColumnsProps> = ({
  before,
  after,
  "data-testid-prefix": testIdPrefix,
}) => {
  const { t } = useTranslation()
  const hasBefore = before !== undefined && before !== null
  const hasAfter = after !== undefined && after !== null
  return (
    <div
      className={css`
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
        ${respondToOrLarger.lg} {
          grid-template-columns: ${hasBefore && hasAfter ? "1fr 1fr" : "1fr"};
        }
      `}
    >
      {hasBefore && (
        <section className={columnCss} data-testid={`${testIdPrefix}-before`}>
          <h4 className={columnHeadingCss}>{t("agent-before")}</h4>
          {before}
        </section>
      )}
      {hasAfter && (
        <section className={columnCss} data-testid={`${testIdPrefix}-after`}>
          <h4 className={columnHeadingCss}>{t("agent-after")}</h4>
          {after}
        </section>
      )}
    </div>
  )
}

export default BeforeAfterColumns
