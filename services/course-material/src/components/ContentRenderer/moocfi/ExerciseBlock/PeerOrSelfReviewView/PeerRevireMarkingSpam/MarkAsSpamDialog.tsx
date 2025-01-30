import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import RadioButton from "@/shared-module/common/components/InputFields/RadioButton"
import StandardDialog from "@/shared-module/common/components/StandardDialog"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`
export const ReportReasonValues = {
  // eslint-disable-next-line i18next/no-literal-string
  Spam: "Spam",
  // eslint-disable-next-line i18next/no-literal-string
  HarmfulContent: "HarmfulContent",
  // eslint-disable-next-line i18next/no-literal-string
  AiGenerated: "AiGenerated",
} as const

// Ensure the type aligns with the backend type
export type ReportReason = (typeof ReportReasonValues)[keyof typeof ReportReasonValues]

const MarkAsSpamDialog: React.FC<{
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: ReportReason, description: string) => void
}> = ({ isOpen, onClose, onSubmit }) => {
  const { t } = useTranslation()
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null)
  const [description, setDescription] = useState<string>("")

  const handleSubmit = () => {
    if (selectedReason) {
      onSubmit(selectedReason, description)
      setSelectedReason(null)
      setDescription("")
      onClose()
    }
  }

  return (
    <StandardDialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="report-dialog-title"
      title={t("title-report-dialog")}
      buttons={[
        {
          // eslint-disable-next-line i18next/no-literal-string
          variant: "primary",
          onClick: () => handleSubmit(),
          disabled: !selectedReason,
          children: t("submit-button"),
        },
      ]}
    >
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        {t("select-reason")}
        <FieldContainer>
          <RadioButton
            label={t("flagging-reason-spam")}
            value={ReportReasonValues.Spam}
            // eslint-disable-next-line i18next/no-literal-string
            name="reason"
            onChange={() => setSelectedReason(ReportReasonValues.Spam)}
          />
        </FieldContainer>
        <FieldContainer>
          <RadioButton
            label={t("flagging-reason-harmful-content")}
            value={ReportReasonValues.HarmfulContent}
            // eslint-disable-next-line i18next/no-literal-string
            name="reason"
            onChange={() => setSelectedReason(ReportReasonValues.HarmfulContent)}
          />
        </FieldContainer>
        <FieldContainer>
          <RadioButton
            label={t("flagging-reason-ai-generated")}
            value={ReportReasonValues.AiGenerated}
            // eslint-disable-next-line i18next/no-literal-string
            name="reason"
            onChange={() => setSelectedReason(ReportReasonValues.AiGenerated)}
          />
        </FieldContainer>
      </div>

      <textarea
        placeholder={t("optional-description")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={css`
          width: 100%;
          height: 5rem;
          margin-bottom: 1rem;
          padding: 10px 12px;
        `}
      />
    </StandardDialog>
  )
}

export default MarkAsSpamDialog
