"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { Button, Infobox, Link, useDialog } from "@/shared-module/components"
import { CheckIcon } from "@/shared-module/components/components/primitives/CheckIcon"

import { certificateHref } from "../certificateHref"
import { BUTTON_PRIMARY, BUTTON_TERTIARY, CREDIT_REGISTRATION_NS, TONE } from "../constants"
import type { CertificateOffer } from "../creditRegistrationSubject"
import { useIsDemoMode } from "../demoMode"
import { useGoToCertificate } from "../useGoToCertificate"
import {
  captionCss,
  fullWidthCss,
  pageCss,
  pageHeadingCss,
  statusHeadCss,
  statusMarkDoneCss,
} from "./stepperStyles"

export interface CertificateChosenPageProps {
  certificate: CertificateOffer | null
  isWithdrawing: boolean
  onChangeChoice: () => void
}

/**
 * Where a student who took the certificate lands when they come back: the certificate, and the
 * one way to registering after all.
 */
export const CertificateChosenPage: React.FC<CertificateChosenPageProps> = ({
  certificate,
  isWithdrawing,
  onChangeChoice,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isDemoMode = useIsDemoMode()
  const { alert } = useDialog()
  const certificateNavigation = useGoToCertificate(certificate)
  return (
    <div className={pageCss}>
      <div className={statusHeadCss}>
        <span className={statusMarkDoneCss} aria-hidden="true">
          <CheckIcon />
        </span>
        <h2 className={pageHeadingCss} tabIndex={-1}>
          {t("credit-registration-certificate-chosen-heading")}
        </h2>
      </div>
      {isDemoMode ? (
        <Button
          variant={BUTTON_PRIMARY}
          size="large"
          className={fullWidthCss}
          onClick={() =>
            void alert({
              title: t("credit-registration-demo-certificate-dialog-title"),
              message: t("credit-registration-demo-certificate-dialog-body"),
            })
          }
        >
          {t("credit-registration-button-go-to-the-certificate")}
        </Button>
      ) : certificate?.kind === "mooc_fi" ? (
        <>
          <Button
            variant={BUTTON_PRIMARY}
            size="large"
            className={fullWidthCss}
            isLoading={certificateNavigation.isPending}
            onClick={() => void certificateNavigation.goToCertificate()}
          >
            {t("credit-registration-button-go-to-the-certificate")}
          </Button>
          {certificateNavigation.isError ? (
            <Infobox tone={TONE.DANGER} announce>
              {t("credit-registration-moocfi-certificate-failed")}
            </Infobox>
          ) : null}
        </>
      ) : certificate ? (
        <Link
          href={certificateHref(certificate)}
          styledAsButton
          variant={BUTTON_PRIMARY}
          size="large"
          className={fullWidthCss}
        >
          {t("credit-registration-button-go-to-the-certificate")}
        </Link>
      ) : null}
      <p className={captionCss}>
        {t("credit-registration-need-registration-instead")}{" "}
        <Button
          variant={BUTTON_TERTIARY}
          size="small"
          isLoading={isWithdrawing}
          onClick={onChangeChoice}
        >
          {t("credit-registration-change-your-choice")}
        </Button>
      </p>
    </div>
  )
}
