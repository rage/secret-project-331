"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { Button, Link, useDialog } from "@/shared-module/components"

import { certificateHref } from "./certificateHref"
import { BUTTON_PRIMARY } from "./constants"
import type { ModuleCertificateOffer } from "./creditRegistrationSubject"
import { useIsDemoMode } from "./demoMode"
import { bandCss, headingCss, rowCss } from "./styles"

export interface CertificateHandoffProps {
  certificate: ModuleCertificateOffer
}

/**
 * Where the detour ends for a student a certificate serves: nothing more to answer, and no email
 * matching to warn about, because a certificate is issued to the account rather than matched to it.
 */
export const CertificateHandoff: React.FC<CertificateHandoffProps> = ({ certificate }) => {
  // Default namespace, like the registration page this band belongs to, not the
  // `credit-registration` one the rest of this folder reads.
  const { t } = useTranslation()
  const isDemoMode = useIsDemoMode()
  const { alert } = useDialog()
  return (
    <section className={bandCss}>
      <h2 className={headingCss}>{t("heading-your-certificate-is-ready")}</h2>
      <p>{t("you-can-get-your-certificate-of-completion-right-away")}</p>
      <div className={rowCss}>
        {isDemoMode ? (
          <Button
            variant={BUTTON_PRIMARY}
            size="medium"
            onClick={() =>
              void alert({
                title: t("credit-registration-demo-certificate-dialog-title"),
                message: t("credit-registration-demo-certificate-dialog-body"),
              })
            }
          >
            {t("go-to-certificate")}
          </Button>
        ) : (
          <Link
            href={certificateHref(certificate)}
            styledAsButton
            variant={BUTTON_PRIMARY}
            size="medium"
          >
            {t("go-to-certificate")}
          </Link>
        )}
      </div>
    </section>
  )
}
