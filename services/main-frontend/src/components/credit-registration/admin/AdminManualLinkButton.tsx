"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { includeIf } from "@/shared-module/common/utils/nullability"
import type { ButtonSize } from "@/shared-module/components"
import { Button } from "@/shared-module/components"

import AdminManualLinkDialog from "./AdminManualLinkDialog"

interface Props {
  /** Seeds the dialog's number field where the caller already knows whose row this is. */
  studentNumber?: string
  label?: string
  size?: ButtonSize
}

/** The escape hatch for a student no mail can reach. */
const AdminManualLinkButton: React.FC<Props> = ({ studentNumber, label, size = "medium" }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="tertiary" size={size} onClick={() => setOpen(true)}>
        {label ?? t("credit-registration-admin-manual-link-title")}
      </Button>
      {open && (
        <AdminManualLinkDialog
          open
          onClose={() => setOpen(false)}
          {...includeIf(studentNumber, { studentNumber })}
        />
      )}
    </>
  )
}

export default AdminManualLinkButton
