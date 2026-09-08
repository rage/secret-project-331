"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { includeIf } from "@/shared-module/common/utils/nullability"
import type { ButtonVariant } from "@/shared-module/components"
import { Button } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS } from "../constants"
import type { ManualLinkAccount } from "./AdminManualLinkDialog"
import AdminManualLinkDialog from "./AdminManualLinkDialog"

interface Props {
  /** Seeds the dialog's number field where the caller already knows whose row this is. */
  studentNumber?: string
  /** Seeds the dialog's account, where the caller already knows which one to link to. */
  account?: ManualLinkAccount
  label?: string
  variant?: ButtonVariant
}

/** The escape hatch for a student no mail can reach. */
const AdminManualLinkButton: React.FC<Props> = ({
  studentNumber,
  account,
  label,
  variant = "tertiary",
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant={variant} size="medium" onClick={() => setOpen(true)}>
        {label ?? t("credit-registration-admin-manual-link-title")}
      </Button>
      {open && (
        <AdminManualLinkDialog
          open
          onClose={() => setOpen(false)}
          {...includeIf(studentNumber, { studentNumber })}
          {...includeIf(account, { account })}
        />
      )}
    </>
  )
}

export default AdminManualLinkButton
