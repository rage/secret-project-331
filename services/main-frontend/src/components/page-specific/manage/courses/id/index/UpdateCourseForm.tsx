import { css } from "@emotion/css"
import styled from "@emotion/styled"
// import { TextField } from "@material-ui/core"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { updateCourse } from "../../../../../../services/backend/courses"
import Button from "../../../../../../shared-module/components/Button"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"

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
  const { t } = useTranslation()
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
            // fullWidth
            // id="outlined-required"
            label={t("text-field-label-name")}
            // variant="outlined"
            value={name}
            onChange={(value) => {
              setName(value)
            }}
          />
        </FieldContainer>
      </div>
      <div>
        <Button size="medium" variant="primary" onClick={onUpdateCourseForm}>
          {t("button-text-update")}
        </Button>
      </div>
    </div>
  )
}

export default UpdateCourseForm
