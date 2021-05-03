import styled from "@emotion/styled"
import { TextField } from "@material-ui/core"
import React from "react"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface UpdatePageDetailsFormProps {
  title: string
  urlPath: string
  setTitle: (newTitle: string) => void
  setUrlPath: (newUrlPath: string) => void
}

const UpdatePageDetailsForm: React.FC<UpdatePageDetailsFormProps> = ({
  title,
  urlPath,
  setTitle,
  setUrlPath,
}) => {
  return (
    <div style={{ padding: "1em" }}>
      <div>
        <FieldContainer>
          <TextField
            required
            id="outlined-required"
            label="Title"
            variant="outlined"
            value={title}
            fullWidth
            onChange={(e) => {
              setTitle(e.target.value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            id="outlined-required"
            label="Path"
            variant="outlined"
            value={urlPath}
            fullWidth
            onChange={(e) => {
              setUrlPath(e.target.value)
            }}
          />
        </FieldContainer>
      </div>
    </div>
  )
}

export default UpdatePageDetailsForm
