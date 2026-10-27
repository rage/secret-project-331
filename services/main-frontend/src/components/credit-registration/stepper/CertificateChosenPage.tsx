"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { Button, Link, useDialog } from "@/shared-module/components"
import { CheckIcon } from "@/shared-module/components/components/primitives/CheckIcon"

import { certificateHref } from "../certificateHref"
import { BUTTON_PRIMARY, BUTTON_TERTIARY, CREDIT_REGISTRATION_NS } from "../constants"
import { useIsDemoMode } from "../demoMode"
import {
  captionCss,
  fullWidthCss,
  pageCss,
  pageHeadingCss,
  statusHeadCss,
  statusMarkDoneCss,
} from "./stepperStyles"

export interface CertificateChosenPageProps {
  courseModuleId: string
  certificateConfigurationId: string | null | undefined
  isWithdrawing: boolean
  onChangeChoice: () => void
}

/**
 * Where a student who took the certificate lands when they come back: the certificate, and the
 * one way to registering after all.
 */
export const CertificateChosenPage: React.FC<CertificateChosenPageProps> = ({
  courseModuleId,
  certificateConfigurationId,
  isWithdrawing,
  onChangeChoice,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isDemoMode = useIsDemoMode()
  const { alert } = useDialog()
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
      ) : certificateConfigurationId ? (
        <Link
          href={certificateHref(courseModuleId, certificateConfigurationId)}
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
