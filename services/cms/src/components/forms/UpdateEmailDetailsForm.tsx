import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { TextField } from "@material-ui/core"
import React from "react"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface UpdateEmailDetailsFormProps {
  name: string
  subject: string
  setName: (newName: string) => void
  setSubject: (newSubject: string) => void
}

const UpdateEmailDetailsForm: React.FC<UpdateEmailDetailsFormProps> = ({
  name,
  subject,
  setName,
  setSubject,
}) => {
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
            label="Template name"
            variant="outlined"
            value={name}
            fullWidth
            onChange={(e) => {
              setName(e.target.value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            id="outlined-required"
            label="Email subject"
            variant="outlined"
            value={subject}
            fullWidth
            onChange={(e) => {
              setSubject(e.target.value)
            }}
          />
        </FieldContainer>
      </div>
    </div>
  )
}

export default UpdateEmailDetailsForm
