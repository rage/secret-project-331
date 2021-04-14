import { Button, TextField } from "@material-ui/core"
import { withStyles } from "@material-ui/styles"
import React, { useState } from "react"
import { postNewPage } from "../services/postData"
import { useRouter } from "next/router"

const StyledTextField = withStyles({
  root: {
    margin: "0.5em",
  },
})(TextField)

const StyledButton = withStyles({
  root: {
    margin: "0.5em",
  },
})(Button)

interface NewPageProps {
  courseId: string
}

const NewPage: React.FC<NewPageProps> = ({ courseId }) => {
  const [path, setPath] = useState("")
  const [title, setTitle] = useState("")
  const router = useRouter()

  const createNewPage = async () => {
    const res = await postNewPage({
      course_id: courseId,
      content: [],
      url_path: path,
      title,
      exercises: [],
    })
    router.push(`/pages/${res.id}`)
  }

  return (
    <div style={{ padding: "1em" }}>
      <div>
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
        <StyledTextField
          required
          id="outlined-required"
          label="Title"
          variant="outlined"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
          }}
        />
      </div>
      <div>
        <StyledButton onClick={createNewPage}>Create page</StyledButton>
      </div>
    </div>
  )
}

export default NewPage
