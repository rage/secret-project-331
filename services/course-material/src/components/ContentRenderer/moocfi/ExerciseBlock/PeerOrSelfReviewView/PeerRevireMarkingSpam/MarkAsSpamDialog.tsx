import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import Dialog from "@/shared-module/common/components/Dialog"
import RadioButton from "@/shared-module/common/components/InputFields/RadioButton"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

const MarkAsSpamDialog: React.FC<{
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: string, description: string) => void
}> = ({ isOpen, onClose, onSubmit }) => {
  const { t } = useTranslation()
  const [selectedReason, setSelectedReason] = useState<string>("")
  const [description, setDescription] = useState<string>("")

  const handleSubmit = () => {
    if (selectedReason) {
      onSubmit(selectedReason, description)
      setSelectedReason("")
      setDescription("")
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <h1> {t("title-report-dialog")}</h1>

      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        {t("select-reason")}
        <FieldContainer>
          <RadioButton
            label={t("flagging-reason-spam")}
            value={t("flagging-reason-spam")}
            // eslint-disable-next-line i18next/no-literal-string
            name={"reason"}
            onChange={(e) => setSelectedReason(e.target.value)}
          ></RadioButton>
        </FieldContainer>
        <FieldContainer>
          <RadioButton
            label={t("flagging-reason-harmful-content")}
            value={t("flagging-reason-harmful-content")}
            // eslint-disable-next-line i18next/no-literal-string
            name={"reason"}
            onChange={(e) => setSelectedReason(e.target.value)}
          ></RadioButton>
        </FieldContainer>
        <FieldContainer>
          <RadioButton
            label={t("flagging-reason-ai-generated")}
            value={t("flagging-reason-ai-generated")}
            // eslint-disable-next-line i18next/no-literal-string
            name={"reason"}
            onChange={(e) => setSelectedReason(e.target.value)}
          ></RadioButton>
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
        `}
      />
      <Button variant="primary" onClick={handleSubmit} disabled={!selectedReason} size={"small"}>
        {t("submit-button")}
      </Button>
    </Dialog>
  )
}

export default MarkAsSpamDialog
