"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { ButtonVariant } from "@/shared-module/components"
import { Button } from "@/shared-module/components"

import AdminResendLinkingEmailDialog from "./AdminResendLinkingEmailDialog"

interface Props {
  studentNumber: string
  courseId: string
  courseName: string
  variant?: ButtonVariant
}

/** The resend dialog behind a button of its own, for a page that offers it as one of its actions. */
const AdminResendLinkingEmailButton: React.FC<Props> = ({
  studentNumber,
  courseId,
  courseName,
  variant = "secondary",
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant={variant} size="medium" onClick={() => setOpen(true)}>
        {t("button-text-resend-linking-email")}
      </Button>
      <AdminResendLinkingEmailDialog
        open={open}
        onClose={() => setOpen(false)}
        studentNumber={studentNumber}
        courseId={courseId}
        courseName={courseName}
      />
    </>
  )
}

export default AdminResendLinkingEmailButton
