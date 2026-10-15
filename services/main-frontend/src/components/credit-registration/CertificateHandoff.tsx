"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { Link } from "@/shared-module/components"

import { BUTTON_PRIMARY } from "./constants"
import { bandCss, headingCss, rowCss } from "./styles"

const GENERATE_CERTIFICATE_PATH = "/generate-certificate"

export interface CertificateHandoffProps {
  courseModuleId: string
  certificateConfigurationId: string
}

/**
 * Where the detour ends for a student a certificate serves: nothing more to answer, and no email
 * matching to warn about, because a certificate is issued to the account rather than matched to it.
 */
export const CertificateHandoff: React.FC<CertificateHandoffProps> = ({
  courseModuleId,
  certificateConfigurationId,
}) => {
  // Default namespace, like the registration page this band belongs to, not the
  // `credit-registration` one the rest of this folder reads.
  const { t } = useTranslation()
  return (
    <section className={bandCss}>
      <h2 className={headingCss}>{t("heading-your-certificate-is-ready")}</h2>
      <p>{t("you-can-get-your-certificate-of-completion-right-away")}</p>
      <div className={rowCss}>
        <Link
          href={`${GENERATE_CERTIFICATE_PATH}?module=${courseModuleId}&ccid=${certificateConfigurationId}`}
          styledAsButton
          variant={BUTTON_PRIMARY}
          size="medium"
        >
          {t("go-to-certificate")}
        </Link>
      </div>
    </section>
  )
}
