"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

import type { ClientToolBubbleProps } from "./clientToolRegistry"
import ConfirmActionBubble from "./ConfirmActionBubble"
import { UPDATE_CERTIFICATE_TOOL } from "./updateCertificateCalls"
import type { UpdateCertificateCall } from "./updateCertificateCalls"

type UpdateCertificateBubbleProps = ClientToolBubbleProps<UpdateCertificateCall>

const rowStyle = css`
  margin: 0;
`

const footnoteStyle = css`
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[500]};
`

/**
 * A confirm bubble for `update_certificate`. The rows are an old → new diff built purely from the
 * call's arguments; the certificate is only touched, and only if the current name still matches,
 * once the admin confirms.
 */
const UpdateCertificateBubble: React.FC<UpdateCertificateBubbleProps> = ({ call, ...rest }) => {
  const { t } = useTranslation()

  const nameChanged =
    call.newNameOnCertificate.length > 0 &&
    call.newNameOnCertificate !== call.currentNameOnCertificate

  const rows = (
    <>
      {nameChanged && (
        <p className={rowStyle}>
          {t("chatbot-update-certificate-name-row", {
            currentName: call.currentNameOnCertificate,
            newName: call.newNameOnCertificate,
          })}
        </p>
      )}
      {call.newDateIssued.length > 0 && (
        <p className={rowStyle}>
          {t("chatbot-update-certificate-date-row", { date: call.newDateIssued })}
        </p>
      )}
      <p className={footnoteStyle}>{t("chatbot-update-certificate-footnote")}</p>
    </>
  )

  return (
    <ConfirmActionBubble
      {...rest}
      call={call}
      toolName={UPDATE_CERTIFICATE_TOOL}
      title={t("chatbot-update-certificate-title")}
      rows={rows}
      danger={false}
      confirmLabel={t("chatbot-update-certificate-confirm-label")}
    />
  )
}

export default UpdateCertificateBubble
