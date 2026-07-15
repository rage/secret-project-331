"use client"

import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { Radio, RadioGroup, TextArea } from "@/shared-module/components"

export const ReportReasonValues = {
  // oxlint-disable-next-line i18next/no-literal-string
  Spam: "Spam",
  // oxlint-disable-next-line i18next/no-literal-string
  HarmfulContent: "HarmfulContent",
  // oxlint-disable-next-line i18next/no-literal-string
  AiGenerated: "AiGenerated",
} as const

// Ensure the type aligns with the backend type
export type ReportReason = (typeof ReportReasonValues)[keyof typeof ReportReasonValues]

interface ReportFormFields {
  reason: string
  description: string
}

const MarkAsSpamDialog: React.FC<{
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: ReportReason, description: string) => void
}> = ({ isOpen, onClose, onSubmit }) => {
  const { t } = useTranslation()
  const { control, watch, reset } = useForm<ReportFormFields>({
    defaultValues: { reason: "", description: "" },
  })
  const selectedReason = watch("reason")

  const handleSubmit = () => {
    if (selectedReason) {
      onSubmit(selectedReason as ReportReason, watch("description"))
      reset()
      onClose()
    }
  }

  return (
    <StandardDialog
      open={isOpen}
      onClose={onClose}
      title={t("title-report-dialog")}
      buttons={[
        {
          variant: "primary",
          onClick: () => handleSubmit(),
          disabled: !selectedReason,
          children: t("submit-button"),
        },
      ]}
    >
      <RadioGroup
        name="reason"
        control={control}
        label={t("select-reason")}
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <Radio value={ReportReasonValues.Spam} label={t("flagging-reason-spam")} />
        <Radio
          value={ReportReasonValues.HarmfulContent}
          label={t("flagging-reason-harmful-content")}
        />
        <Radio value={ReportReasonValues.AiGenerated} label={t("flagging-reason-ai-generated")} />
      </RadioGroup>

      <TextArea
        name="description"
        control={control}
        label={t("optional-description")}
        rows={3}
        className={css`
          margin-bottom: 1rem;
        `}
      />
    </StandardDialog>
  )
}

export default MarkAsSpamDialog
