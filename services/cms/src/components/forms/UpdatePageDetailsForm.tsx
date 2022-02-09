import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { TextField } from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface UpdatePageDetailsFormProps {
  title: string
  setTitle: (newTitle: string) => void
}

const UpdatePageDetailsForm: React.FC<UpdatePageDetailsFormProps> = ({ title, setTitle }) => {
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
            id="outlined-required"
            label={t("label-title")}
            variant="outlined"
            value={title}
            fullWidth
            onChange={(e) => {
              setTitle(e.target.value)
            }}
          />
        </FieldContainer>
      </div>
    </div>
  )
}

export default UpdatePageDetailsForm
