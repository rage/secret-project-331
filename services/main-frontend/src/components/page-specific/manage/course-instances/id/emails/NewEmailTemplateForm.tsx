import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"

const StyledTextField = styled(TextField)`
  margin: 0.3rem;
`
const StyledButton = styled(Button)`
  margin: 0.3rem;
`

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewEmailTemplateFormProps {
  onSubmitForm: (newName: string) => void
}

const NewEmailTemplateForm: React.FC<React.PropsWithChildren<NewEmailTemplateFormProps>> = ({
  onSubmitForm,
}) => {
  const { t } = useTranslation()
  const [name, setName] = useState("")

  return (
    <div
      className={css`
        padding: 1rem 0;
      `}
    >
      <div>
        <FieldContainer>
          <StyledTextField
            required
            label={t("text-field-label-name")}
            value={name}
            onChangeByValue={(value) => {
              setName(value)
            }}
          />
        </FieldContainer>
      </div>
      <div>
        <StyledButton size="medium" variant="primary" onClick={() => onSubmitForm(name)}>
          {t("button-text-create")}
        </StyledButton>
      </div>
    </div>
  )
}

export default NewEmailTemplateForm
