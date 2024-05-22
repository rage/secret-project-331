import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import TextField from "@/shared-module/common/components/InputFields/TextField"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface UpdatePageDetailsFormProps {
  title: string
  setTitle: (newTitle: string) => void
}

const UpdatePageDetailsForm: React.FC<React.PropsWithChildren<UpdatePageDetailsFormProps>> = ({
  title,
  setTitle,
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
            label={t("label-title")}
            value={title}
            onChangeByValue={(value) => {
              setTitle(value)
            }}
          />
        </FieldContainer>
      </div>
    </div>
  )
}

export default UpdatePageDetailsForm
