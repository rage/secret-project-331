import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Button, TextField } from "@material-ui/core"
import React, { useState } from "react"
import { updateCourse } from "../../services/backend/courses"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface UpdateCourseFormProps {
  courseId: string
  courseName: string
  onSubmitForm: () => void
}

const UpdateCourseForm: React.FC<UpdateCourseFormProps> = ({
  courseId,
  courseName,
  onSubmitForm,
}) => {
  const [name, setName] = useState(courseName)

  const onUpdateCourseForm = async () => {
    await updateCourse(courseId, {
      name,
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
            }}
          />
        </FieldContainer>
      </div>
      <div>
        <Button onClick={onUpdateCourseForm}>Update course</Button>
      </div>
    </div>
  )
}

export default UpdateCourseForm
