"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { CREDIT_REGISTRATION_NS } from "./constants"
import { cardTitleBandCss, noteCss, pageTitleCss, subheadingCss } from "./styles"

/** The card's title band: which credits the page is about. An empty `courseName` leaves it out. */
export const CardHeading: React.FC<{
  courseName: string
  moduleName: string | null | undefined
  ectsCredits: number | null | undefined
  signedInEmail?: string | undefined
}> = ({ courseName, moduleName, ectsCredits, signedInEmail }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <header className={cardTitleBandCss}>
      <h1 className={pageTitleCss}>{t("register-completion")}</h1>
      {courseName ? (
        <p className={subheadingCss}>
          {t("course")}:{" "}
          {moduleName
            ? t("credit-registration-course-and-module", { course: courseName, module: moduleName })
            : courseName}
        </p>
      ) : null}
      {typeof ectsCredits === "number" ? (
        <p className={noteCss}>{t("credits-n-ects", { count: ectsCredits, n: ectsCredits })}</p>
      ) : null}
      {signedInEmail ? (
        <p className={noteCss}>{t("credit-registration-signed-in-as", { email: signedInEmail })}</p>
      ) : null}
    </header>
  )
}
