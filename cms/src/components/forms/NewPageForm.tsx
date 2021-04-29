import { Button, TextField } from "@material-ui/core"
import { withStyles } from "@material-ui/styles"
import React, { useState } from "react"
import { postNewPage } from "../../services/backend/pages"
import { normalizePath } from "../../utils/normalizePath"

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

interface NewPageFormProps {
  courseId: string
  onSubmitForm: () => void
}

const NewPageForm: React.FC<NewPageFormProps> = ({ courseId, onSubmitForm }) => {
  const [path, setPath] = useState("/")
  const [title, setTitle] = useState("")

  const createNewPage = async () => {
    await postNewPage({
      course_id: courseId,
      content: [],
      url_path: path,
      title,
      exercises: [],
    })
    onSubmitForm()
  }

  return (
    <div style={{ padding: "1em" }}>
      <div>
        <StyledTextField
          required
          id="outlined-required"
          label="Title"
          variant="outlined"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setPath(normalizePath(e.target.value))
          }}
        />
        <StyledTextField
          required
          id="outlined-required"
          label="Path"
          variant="outlined"
          value={path}
          onChange={(e) => {
            setPath(e.target.value)
          }}
        />
      </div>
      <div>
        <StyledButton onClick={createNewPage}>Create page</StyledButton>
      </div>
    </div>
  )
}

export default NewPageForm
