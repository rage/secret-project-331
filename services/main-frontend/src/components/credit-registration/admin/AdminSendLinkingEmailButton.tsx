"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/shared-module/components"

import { BUTTON_SECONDARY, CREDIT_REGISTRATION_NS } from "../constants"
import { useIsAccountLinkingEnabled } from "../useIsAccountLinkingEnabled"
import AdminSendLinkingEmailDialog from "./AdminSendLinkingEmailDialog"

/** Opens the dialog for sending a linking email by hand; hidden while account linking is off. */
const AdminSendLinkingEmailButton: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isAccountLinkingEnabled = useIsAccountLinkingEnabled()
  const [open, setOpen] = useState(false)

  if (!isAccountLinkingEnabled) {
    return null
  }
  return (
    <>
      <Button variant={BUTTON_SECONDARY} size="medium" onClick={() => setOpen(true)}>
        {t("button-text-send-a-linking-email")}
      </Button>
      <AdminSendLinkingEmailDialog isOpen={open} onClose={() => setOpen(false)} />
    </>
  )
}

export default AdminSendLinkingEmailButton
