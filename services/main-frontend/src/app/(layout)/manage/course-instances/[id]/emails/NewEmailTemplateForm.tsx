"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button, TextField } from "@/shared-module/components"

const textFieldMarginCss = css`
  margin: 0.3rem;
`
const StyledButton = styled(Button)`
  margin: 0.3rem;
`

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewEmailTemplateFormProps {
  onSubmitForm: (emailTitle: string) => void
}

const NewEmailTemplateForm: React.FC<React.PropsWithChildren<NewEmailTemplateFormProps>> = ({
  onSubmitForm,
}) => {
  const { t } = useTranslation()
  const { control, watch } = useForm<{ emailTitle: string }>({
    defaultValues: { emailTitle: "" },
  })
  const emailTitle = watch("emailTitle")

  return (
    <div
      className={css`
        padding: 1rem 0;
      `}
    >
      <div>
        <FieldContainer>
          <TextField
            isRequired
            name="emailTitle"
            control={control}
            label={t("text-field-label-email-title")}
            className={textFieldMarginCss}
          />
        </FieldContainer>
      </div>
      <div>
        <StyledButton size="medium" variant="primary" onClick={() => onSubmitForm(emailTitle)}>
          {t("button-text-create")}
        </StyledButton>
      </div>
    </div>
  )
}

export default NewEmailTemplateForm
