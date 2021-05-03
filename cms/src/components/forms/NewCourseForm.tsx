import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Button, TextField } from "@material-ui/core"
import React, { useState } from "react"
import { postNewCourse } from "../../services/backend/courses"
import { postNewPage } from "../../services/backend/pages"
import { normalizePath } from "../../utils/normalizePath"

const PathFieldWithPrefixElement = styled.div`
  display: flex;
  align-items: center;
`

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewCourseFormProps {
  organizationId: string
  onSubmitForm: () => void
}

const NewCourseForm: React.FC<NewCourseFormProps> = ({ organizationId, onSubmitForm }) => {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")

  const createNewCourse = async () => {
    await postNewCourse({
      name,
      slug,
      organization_id: organizationId,
    })
    onSubmitForm()
  }

  return (
    <div
      className={css`
        width: 500px;
        padding: 1rem;
      `}
    >
      <div>
        <FieldContainer>
          <TextField
            required
            fullWidth
            id="outlined-required"
            label="Course name"
            variant="outlined"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSlug(normalizePath(e.target.value))
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            fullWidth
            id="outlined-required"
            label="Slug"
            variant="outlined"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
            }}
          />
        </FieldContainer>
      </div>
      <div>
        <Button onClick={createNewCourse}>Create course</Button>
      </div>
    </div>
  )
}

export default NewCourseForm
