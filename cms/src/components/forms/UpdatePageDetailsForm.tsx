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
        <StyledTextField
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
        <StyledTextField
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
      </div>
    </div>
  )
}

export default UpdatePageDetailsForm
