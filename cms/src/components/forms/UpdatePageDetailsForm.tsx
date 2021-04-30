import { Button, TextField } from "@material-ui/core"
import { withStyles } from "@material-ui/styles"
import React, { useState } from "react"

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

interface UpdatePageDetailsFormProps {
  title: string
  urlPath: string
  onUpdateCourseData: (newTitle: string, newPath: string) => void
}

const UpdatePageDetailsForm: React.FC<UpdatePageDetailsFormProps> = ({
  title,
  urlPath,
  onUpdateCourseData,
}) => {
  const [newTitle, setNewTitle] = useState(title)
  const [newUrlPath, setNewUrlPath] = useState(urlPath)

  const onUpdate = () => {
    onUpdateCourseData(newTitle, newUrlPath)
  }

  return (
    <div style={{ padding: "1em" }}>
      <div>
        <StyledTextField
          required
          id="outlined-required"
          label="Title"
          variant="outlined"
          value={newTitle}
          fullWidth
          onChange={(e) => {
            setNewTitle(e.target.value)
          }}
        />
        <StyledTextField
          required
          id="outlined-required"
          label="Path"
          variant="outlined"
          value={newUrlPath}
          fullWidth
          onChange={(e) => {
            setNewUrlPath(e.target.value)
          }}
        />
      </div>
      <div>
        <StyledButton onClick={onUpdate}>Update</StyledButton>
      </div>
    </div>
  )
}

export default UpdatePageDetailsForm
