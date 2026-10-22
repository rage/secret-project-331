"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/shared-module/components"

import { BUTTON_PRIMARY, CREDIT_REGISTRATION_NS } from "../constants"
import { fullWidthCss, overviewNumberCss, pageCss, srOnlyCss } from "./stepperStyles"

const listCss = css`
  margin: 0;
  padding: 0;
  list-style: none;
`

const rowCss = css`
  display: flex;
  gap: var(--space-4);
  align-items: center;
  padding: 14px 0;

  & + & {
    border-top: 1px solid var(--color-clear-300);
  }
`

const rowTitleCss = css`
  font-size: var(--font-size-3);
  font-weight: 600;
  line-height: 1.3;
`

const closingCss = css`
  padding: 14px var(--space-4);
  border-radius: var(--surface-radius);
  background: var(--color-clear-100);
`

export interface OverviewPageProps {
  /** The linked number, or `null` when linking is one of the steps. */
  studentNumber: string | null
  onStart: () => void
}

/** The whole job at a glance, so the linking step is known before it comes. */
export const OverviewPage: React.FC<OverviewPageProps> = ({ studentNumber, onStart }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const rows = [
    t("credit-registration-overview-step-questions"),
    t("credit-registration-overview-step-enrol"),
    ...(studentNumber === null ? [t("credit-registration-overview-step-link")] : []),
  ]
  return (
    <div className={pageCss}>
      <h2 className={srOnlyCss} tabIndex={-1}>
        {t("credit-registration-overview-heading")}
      </h2>
      <ol className={listCss}>
        {rows.map((title, index) => (
          <li key={title} className={rowCss}>
            <span className={overviewNumberCss} aria-hidden="true">
              {index + 1}
            </span>
            <span className={rowTitleCss}>{title}</span>
          </li>
        ))}
      </ol>
      <p className={closingCss}>
        {studentNumber === null
          ? t("credit-registration-overview-then-register")
          : t("credit-registration-overview-then-register-under-number", { studentNumber })}
      </p>
      <Button variant={BUTTON_PRIMARY} size="large" className={fullWidthCss} onClick={onStart}>
        {t("credit-registration-button-start")}
      </Button>
    </div>
  )
}
