import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { updateCourse } from "../../../../../../services/backend/courses"
import Button from "../../../../../../shared-module/components/Button"
import CheckBox from "../../../../../../shared-module/components/InputFields/CheckBox"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface UpdateCourseFormProps {
  courseId: string
  courseName: string
  isDraft: boolean
  onSubmitForm: () => void
}

const UpdateCourseForm: React.FC<UpdateCourseFormProps> = ({
  courseId,
  courseName,
  isDraft,
  onSubmitForm,
}) => {
  const { t } = useTranslation()
  const [name, setName] = useState(courseName)
  const [draftStatus, setDraftStatus] = useState(isDraft)

  const onUpdateCourseForm = async () => {
    await updateCourse(courseId, {
      name,
      is_draft: draftStatus,
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
            label={t("text-field-label-name")}
            value={name}
            onChange={(value) => {
              setName(value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <CheckBox
            label={t("draft")}
            onChange={() => {
              setDraftStatus(!draftStatus)
            }}
            checked={draftStatus}
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
