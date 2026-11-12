"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { ButtonVariant } from "@/shared-module/components"
import { Button } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS } from "../constants"
import AdminResendLinkingEmailDialog from "./AdminResendLinkingEmailDialog"

interface Props {
  studentNumber: string
  courseOrTargetId: string
  courseName: string
  variant?: ButtonVariant
}

/** The resend dialog behind a button of its own, for a page that offers it as one of its actions. */
const AdminResendLinkingEmailButton: React.FC<Props> = ({
  studentNumber,
  courseOrTargetId,
  courseName,
  variant = "secondary",
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant={variant} size="medium" onClick={() => setOpen(true)}>
        {t("button-text-resend-linking-email")}
      </Button>
      <AdminResendLinkingEmailDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        studentNumber={studentNumber}
        courseOrTargetId={courseOrTargetId}
        courseName={courseName}
      />
    </>
  )
}

export default AdminResendLinkingEmailButton
