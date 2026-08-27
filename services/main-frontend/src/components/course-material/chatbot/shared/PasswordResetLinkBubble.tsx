"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"

import type { ClientToolBubbleProps } from "./clientToolRegistry"
import ConfirmActionBubble from "./ConfirmActionBubble"
import { GENERATE_PASSWORD_RESET_LINK_TOOL, resetLinkOf } from "./passwordResetLinkCalls"
import type { PasswordResetLinkCall } from "./passwordResetLinkCalls"

type PasswordResetLinkBubbleProps = ClientToolBubbleProps<PasswordResetLinkCall>

const rowStyle = css`
  margin: 0;
`

const linkRowStyle = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0 0;
`

const linkStyle = css`
  font-family: monospace;
  font-size: 0.85rem;
  overflow-wrap: anywhere;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  background-color: ${baseTheme.colors.clear[50]};
  border: 1px solid ${baseTheme.colors.green[300]};
`

const missingPayloadStyle = css`
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
`

/** A confirm bubble for `generate_password_reset_link`, showing the link only in this browser. */
const PasswordResetLinkBubble: React.FC<PasswordResetLinkBubbleProps> = ({
  call,
  executionPayload,
  ...rest
}) => {
  const { t } = useTranslation()
  const resetLink = resetLinkOf(executionPayload)

  const handleCopy = () => {
    if (resetLink) {
      void navigator.clipboard.writeText(resetLink)
    }
  }

  return (
    <ConfirmActionBubble
      {...rest}
      call={call}
      executionPayload={executionPayload}
      toolName={GENERATE_PASSWORD_RESET_LINK_TOOL}
      title={t("chatbot-generate-password-reset-link-title")}
      danger={false}
      confirmLabel={t("chatbot-generate-password-reset-link-confirm-label")}
      rows={
        <p className={rowStyle}>
          {t("chatbot-generate-password-reset-link-email-row", { email: call.userEmail })}
        </p>
      }
      executedContent={
        resetLink ? (
          <div className={linkRowStyle}>
            <span className={linkStyle}>{resetLink}</span>
            <Button variant="secondary" size="small" onClick={handleCopy}>
              {t("copy-to-clipboard")}
            </Button>
          </div>
        ) : (
          <p className={missingPayloadStyle}>{t("chatbot-password-reset-link-payload-missing")}</p>
        )
      }
    />
  )
}

export default PasswordResetLinkBubble
