import styled from "@emotion/styled"
import { Button, TextField } from "@material-ui/core"
import React, { useState } from "react"
import { postNewCoursePart } from "../../services/backend/courses"

const StyledTextField = styled(TextField)`
  margin: 0.3rem;
`
const StyledButton = styled(Button)`
  margin: 0.3rem;
`
interface NewPartFormProps {
  courseId: string
  onSubmitForm: () => void
  partNumber: number
}

const NewPartForm: React.FC<NewPartFormProps> = ({ courseId, onSubmitForm, partNumber }) => {
  const [part, setPart] = useState<number | undefined>(partNumber)
  const [name, setName] = useState<string>("")

  const createNewCoursePart = async () => {
    if (part !== undefined) {
      await postNewCoursePart({
        course_id: courseId,
        name: name,
        part_number: part,
        page_id: null,
      })
      onSubmitForm()
    }
  }

  return (
    <div style={{ padding: "1em" }}>
      <div>
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
        <StyledTextField
          required
          id="outlined-required"
          fullWidth
          label="Part number"
          variant="outlined"
          type="number"
          value={part}
          onChange={(e) => {
            setPart(Number(e.target.value))
          }}
        />
      </div>
      <div>
        <StyledButton onClick={createNewCoursePart}>Create part</StyledButton>
      </div>
    </div>
  )
}

export default NewPartForm
