"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/shared-module/components"

import AdminManualLinkDialog from "./AdminManualLinkDialog"

/** The escape hatch for a student no mail can reach: one per page, not one per row. */
const AdminManualLinkButton: React.FC = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="tertiary" size="medium" onClick={() => setOpen(true)}>
        {t("credit-registration-admin-manual-link-title")}
      </Button>
      {open && <AdminManualLinkDialog open onClose={() => setOpen(false)} />}
    </>
  )
}

export default AdminManualLinkButton
