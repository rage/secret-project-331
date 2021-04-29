import { Button, TextField } from "@material-ui/core"
import { withStyles } from "@material-ui/styles"
import React, { useState } from "react"
import { postNewCoursePart } from "../../services/backend/courses"

const StyledTextField = withStyles({
  root: {
    margin: "0.3em",
  },
})(TextField)

const StyledButton = withStyles({
  root: {
    margin: "0.3em",
  },
})(Button)
interface NewPartFormProps {
  courseId: string
  onSubmitForm: () => void
}

const NewPartForm: React.FC<NewPartFormProps> = ({ courseId, onSubmitForm }) => {
  const [part, setPart] = useState<number | undefined>(undefined)
  const [name, setName] = useState<string>("")

  const createNewCoursePart = async () => {
    if (part !== undefined) {
      await postNewCoursePart({
        course_id: courseId,
        name: name,
        part_number: part,
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
