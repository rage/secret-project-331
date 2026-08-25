"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

import type { ClientToolBubbleProps } from "./clientToolRegistry"
import ConfirmActionBubble from "./ConfirmActionBubble"
import { EDIT_USER_ACCOUNT_TOOL } from "./editUserAccountCalls"
import type { EditUserAccountCall } from "./editUserAccountCalls"

type EditUserAccountBubbleProps = ClientToolBubbleProps<EditUserAccountCall>

const rowStyle = css`
  margin: 0;
`

const footnoteStyle = css`
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[500]};
`

/**
 * A confirm bubble for `edit_user_account`. The rows are an old → new diff built purely from the
 * call's arguments; the account itself is only touched, and only matching values applied, once
 * the admin confirms.
 */
const EditUserAccountBubble: React.FC<EditUserAccountBubbleProps> = ({ call, ...rest }) => {
  const { t } = useTranslation()

  const emailChanged = call.newEmail.length > 0 && call.newEmail !== call.currentEmail
  const verificationLabel =
    call.markEmailVerified === "verify"
      ? t("chatbot-edit-user-account-verified-value")
      : call.markEmailVerified === "unverify"
        ? t("chatbot-edit-user-account-unverified-value")
        : null

  const rows = (
    <>
      {emailChanged && (
        <p className={rowStyle}>
          {t("chatbot-edit-user-account-email-row", {
            currentEmail: call.currentEmail,
            newEmail: call.newEmail,
          })}
        </p>
      )}
      {verificationLabel && (
        <p className={rowStyle}>
          {t("chatbot-edit-user-account-verification-row", { value: verificationLabel })}
        </p>
      )}
      <p className={footnoteStyle}>{t("chatbot-edit-user-account-footnote")}</p>
    </>
  )

  return (
    <ConfirmActionBubble
      {...rest}
      call={call}
      toolName={EDIT_USER_ACCOUNT_TOOL}
      title={t("chatbot-edit-user-account-title")}
      rows={rows}
      danger={false}
      confirmLabel={t("chatbot-edit-user-account-confirm-label")}
    />
  )
}

export default EditUserAccountBubble
