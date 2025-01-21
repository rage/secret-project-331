import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { updateCourse } from "../../../../../../services/backend/courses"

import { Course } from "@/shared-module/common/bindings"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface UpdateCourseFormProps {
  course: Course
  onSubmitForm: () => void
  open: boolean
  onClose: () => void
}

const UpdateCourseForm: React.FC<React.PropsWithChildren<UpdateCourseFormProps>> = ({
  course,
  onSubmitForm,
  open,
  onClose,
}) => {
  const { t } = useTranslation()
  const [name, setName] = useState(course.name)
  const [description, setDescription] = useState(course.description)
  const [draftStatus, setDraftStatus] = useState(course.is_draft)
  const [testStatus, setTestStatus] = useState(course.is_test_mode)
  const [isUnlisted, setIsUnlisted] = useState(course.is_unlisted)
  const [joinableByCodeOnlyStatus, setjoinableByCodeOnlyStatus] = useState(
    course.is_joinable_by_code_only,
  )
  const [canAddChatbot, setCanAddChatbot] = useState(course.can_add_chatbot)
  const [askMarketingConsent, setAskMarketingConsent] = useState(course.ask_marketing_consent)

  const updateCourseMutation = useToastMutation(
    async () => {
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
        can_add_chatbot: canAddChatbot,
        is_joinable_by_code_only: joinableByCodeOnlyStatus,
        ask_marketing_consent: askMarketingConsent,
      })
      onSubmitForm()
      onClose()
    },
    { method: "PUT", notify: true },
  )

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      title={t("edit-course")}
      buttons={[
        {
          onClick: () => updateCourseMutation.mutate(),
          children: t("button-text-update"),
          // eslint-disable-next-line i18next/no-literal-string
          variant: "primary",
        },
      ]}
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
        <OnlyRenderIfPermissions
          action={{ type: "teach" }}
          resource={{ type: "global_permissions" }}
        >
          <FieldContainer>
            <CheckBox
              label={t("can-enable-chatbot")}
              onChange={() => {
                setCanAddChatbot(!canAddChatbot)
              }}
              checked={canAddChatbot}
            />
          </FieldContainer>
        </OnlyRenderIfPermissions>
        <FieldContainer>
          <CheckBox
            label={t("joinable-by-code-only")}
            onChange={() => {
              setjoinableByCodeOnlyStatus(!joinableByCodeOnlyStatus)
            }}
            checked={joinableByCodeOnlyStatus}
          />
        </FieldContainer>
        <FieldContainer>
          <CheckBox
            label={t("label-ask-for-marketing-consent")}
            onChange={() => {
              setAskMarketingConsent(!askMarketingConsent)
            }}
            checked={askMarketingConsent}
          />
        </FieldContainer>
      </div>
    </StandardDialog>
  )
}

export default UpdateCourseForm
