import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { TextField } from "@material-ui/core"
import React, { useState } from "react"

import { postNewCourse } from "../../services/backend/courses"
import Button from "../../shared-module/components/Button"
import { normalizePath } from "../../utils/normalizePath"

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
        padding: 1rem 0;
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
        <Button size="medium" variant="primary" onClick={createNewCourse}>
          Create course
        </Button>
      </div>
    </div>
  )
}

export default NewCourseForm
