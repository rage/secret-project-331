import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { has } from "lodash"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { updateCourse } from "../../../../../../services/backend/courses"
import Button from "../../../../../../shared-module/components/Button"
import CheckBox from "../../../../../../shared-module/components/InputFields/CheckBox"
import TextAreaField from "../../../../../../shared-module/components/InputFields/TextAreaField"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"
import OnlyRenderIfPermissions from "../../../../../../shared-module/components/OnlyRenderIfPermissions"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface UpdateCourseFormProps {
  courseId: string
  courseName: string
  courseDescription: string | null
  isDraft: boolean
  isTest: boolean
  hasChatbot: boolean
  onSubmitForm: () => void
}

const UpdateCourseForm: React.FC<React.PropsWithChildren<UpdateCourseFormProps>> = ({
  courseId,
  courseName,
  courseDescription,
  isDraft,
  isTest,
  hasChatbot,
  onSubmitForm,
}) => {
  const { t } = useTranslation()
  const [name, setName] = useState(courseName)
  const [description, setDescription] = useState(courseDescription)
  const [draftStatus, setDraftStatus] = useState(isDraft)
  const [testStatus, setTestStatus] = useState(isTest)
  const [hasChatbotStatus, setHasChatbotStatus] = useState(hasChatbot)

  const updateCourseMutation = useToastMutation(
    async () => {
      await updateCourse(courseId, {
        name,
        description,
        is_draft: draftStatus,
        is_test_mode: testStatus,
        can_add_chatbot: hasChatbotStatus,
      })
      onSubmitForm()
    },
    {
      notify: true,
      method: "POST",
    },
  )

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
        <FieldContainer>
          <CheckBox
            label={t("test-course")}
            onChange={() => {
              setTestStatus(!testStatus)
            }}
            checked={testStatus}
          />
        </FieldContainer>
        <OnlyRenderIfPermissions
          action={{ type: "teach" }}
          resource={{ type: "global_permissions" }}
        >
          <FieldContainer>
            <CheckBox
              label={t("can-enable-chatbot")}
              onChange={() => {
                setHasChatbotStatus(!hasChatbotStatus)
              }}
              checked={hasChatbotStatus}
            />
          </FieldContainer>
        </OnlyRenderIfPermissions>
      </div>
      <div>
        <Button size="medium" variant="primary" onClick={() => updateCourseMutation.mutate()}>
          {t("button-text-update")}
        </Button>
      </div>
    </div>
  )
}

export default UpdateCourseForm
