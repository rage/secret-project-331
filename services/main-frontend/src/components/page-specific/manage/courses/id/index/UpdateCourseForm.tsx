import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { updateCourse } from "../../../../../../services/backend/courses"

import { Course } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface UpdateCourseFormProps {
  course: Course
  onSubmitForm: () => void
}

const UpdateCourseForm: React.FC<React.PropsWithChildren<UpdateCourseFormProps>> = ({
  course,
  onSubmitForm,
}) => {
  const { t } = useTranslation()
  const [name, setName] = useState(course.name)
  const [description, setDescription] = useState(course.description)
  const [draftStatus, setDraftStatus] = useState(course.is_draft)
  const [testStatus, setTestStatus] = useState(course.is_test_mode)
  const [isUnlisted, setIsUnlisted] = useState(course.is_unlisted)

  const onUpdateCourseForm = async () => {
    let unlisted = isUnlisted
    if (draftStatus) {
      // Course cannot be unlisted if it is a draft. Draft courses are not displayed to students.
      unlisted = false
    }
    await updateCourse(course.id, {
      name,
      description,
      is_draft: draftStatus,
      is_test_mode: testStatus,
      is_unlisted: unlisted,
    })
    onSubmitForm()
  }

  return (
    <div
      className={css`
        padding: 1rem 0;
      `}
    >
      <div>
        <FieldContainer>
          <TextField
            required
            label={t("text-field-label-name")}
            value={name}
            onChangeByValue={(value) => {
              setName(value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextAreaField
            label={t("text-field-label-description")}
            value={description ?? ""}
            onChangeByValue={(description) => {
              setDescription(description)
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
        {!draftStatus && (
          <FieldContainer>
            <CheckBox
              label={t("unlisted")}
              onChange={() => {
                setIsUnlisted(!isUnlisted)
              }}
              checked={isUnlisted}
            />
          </FieldContainer>
        )}
        <FieldContainer>
          <CheckBox
            label={t("test-course")}
            onChange={() => {
              setTestStatus(!testStatus)
            }}
            checked={testStatus}
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
