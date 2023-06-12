import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import TextField from "../../shared-module/components/InputFields/TextField"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface UpdateEmailDetailsFormProps {
  name: string
  subject: string
  setName: (newName: string) => void
  setSubject: (newSubject: string) => void
}

const UpdateEmailDetailsForm: React.FC<React.PropsWithChildren<UpdateEmailDetailsFormProps>> = ({
  name,
  subject,
  setName,
  setSubject,
}) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        padding: 1rem 0;
      `}
    >
      <div>
        <FieldContainer>
          <TextField
            required
            label={t("label-template-name")}
            value={name}
            onChangeByValue={(value) => {
              setName(value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            label={t("label-email-subject")}
            value={subject}
            onChangeByValue={(value) => {
              setSubject(value)
            }}
          />
        </FieldContainer>
      </div>
    </div>
  )
}

export default UpdateEmailDetailsForm
