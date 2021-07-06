import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Button, TextField } from "@material-ui/core"
import React, { useState } from "react"
import { postNewEmailTemplateForCourseInstance } from "../../services/backend/course-instances"

const StyledTextField = styled(TextField)`
  margin: 0.3rem;
`
const StyledButton = styled(Button)`
  margin: 0.3rem;
`

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewEmailTemplateForm {
  courseInstanceId: string
  onSubmitForm: () => void
}

const NewEmailTemplateForm: React.FC<NewEmailTemplateForm> = ({
  courseInstanceId,
  onSubmitForm,
}) => {
  const [name, setName] = useState<string>("")

  const createNewEmailTemplate = async () => {
    await postNewEmailTemplateForCourseInstance(courseInstanceId, {
      name: name,
    })
    onSubmitForm()
  }

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
            id="outlined-required"
            fullWidth
            label="Name"
            variant="outlined"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
            }}
          />
        </FieldContainer>
      </div>
      <div>
        <StyledButton onClick={createNewEmailTemplate}>Create e-mail template</StyledButton>
      </div>
    </div>
  )
}

export default NewEmailTemplateForm
