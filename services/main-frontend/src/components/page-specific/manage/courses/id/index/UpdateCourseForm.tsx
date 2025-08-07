import styled from "@emotion/styled"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { updateCourse } from "../../../../../../services/backend/courses"

import { Course, CourseUpdate } from "@/shared-module/common/bindings"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import DateTimeLocal from "@/shared-module/common/components/InputFields/DateTimeLocal"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { validateUUID } from "@/shared-module/common/utils/strings"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"

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

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CourseUpdate>({
    defaultValues: {
      name: course.name,
      description: course.description ?? null,
      is_draft: course.is_draft,
      is_test_mode: course.is_test_mode,
      is_unlisted: course.is_unlisted,
      can_add_chatbot: course.can_add_chatbot,
      is_joinable_by_code_only: course.is_joinable_by_code_only,
      ask_marketing_consent: course.ask_marketing_consent,
      flagged_answers_threshold: course.flagged_answers_threshold ?? 3,
      closed_at: course.closed_at ?? null,
      closed_additional_message: course.closed_additional_message ?? null,
      closed_course_successor_id: course.closed_course_successor_id ?? null,
    },
  })

  const draftStatus = watch("is_draft")
  const isClosed = watch("closed_at") !== null && watch("closed_at") !== ""

  const updateCourseMutation = useToastMutation(
    async (data: CourseUpdate) => {
      let unlisted = data.is_unlisted
      if (data.is_draft) {
        // Course cannot be unlisted if it is a draft. Draft courses are not displayed to students.
        unlisted = false
      }
      await updateCourse(course.id, {
        name: data.name,
        description: data.description,
        is_draft: data.is_draft,
        is_test_mode: data.is_test_mode,
        is_unlisted: unlisted,
        can_add_chatbot: data.can_add_chatbot,
        is_joinable_by_code_only: data.is_joinable_by_code_only,
        ask_marketing_consent: data.ask_marketing_consent,
        flagged_answers_threshold: data.flagged_answers_threshold,
        closed_at: data.closed_at || null,
        closed_additional_message: data.closed_additional_message || null,
        closed_course_successor_id: data.closed_course_successor_id || null,
      })
      onSubmitForm()
      onClose()
    },
    { method: "PUT", notify: true },
  )

  const onSubmit = handleSubmit((data) => {
    updateCourseMutation.mutate(data)
  })

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      title={t("edit-course")}
      buttons={[
        {
          onClick: onSubmit,
          children: t("button-text-update"),
          variant: "primary",
        },
      ]}
    >
      <div>
        <FieldContainer>
          <TextField
            required
            label={t("text-field-label-name")}
            error={errors.name?.message}
            {...register("name", { required: t("required-field") })}
          />
        </FieldContainer>
        <FieldContainer>
          <TextAreaField label={t("text-field-label-description")} {...register("description")} />
        </FieldContainer>
        <FieldContainer>
          <CheckBox label={t("draft")} {...register("is_draft")} />
        </FieldContainer>

        {!draftStatus && (
          <FieldContainer>
            <CheckBox label={t("unlisted")} {...register("is_unlisted")} />
          </FieldContainer>
        )}
        <FieldContainer>
          <CheckBox label={t("test-course")} {...register("is_test_mode")} />
        </FieldContainer>
        <OnlyRenderIfPermissions
          action={{ type: "teach" }}
          resource={{ type: "global_permissions" }}
        >
          <FieldContainer>
            <CheckBox label={t("can-enable-chatbot")} {...register("can_add_chatbot")} />
          </FieldContainer>
        </OnlyRenderIfPermissions>
        <FieldContainer>
          <CheckBox label={t("joinable-by-code-only")} {...register("is_joinable_by_code_only")} />
        </FieldContainer>
        <FieldContainer>
          <CheckBox
            label={t("label-ask-for-marketing-consent")}
            {...register("ask_marketing_consent")}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            type={"number"}
            min={0}
            label={t("label-threshold-to-move-flagged-answer-to-manual-review")}
            error={errors.flagged_answers_threshold?.message}
            {...register("flagged_answers_threshold", {
              valueAsNumber: true,
              min: { value: 0, message: t("threshold-must-be-non-negative") },
            })}
          />
        </FieldContainer>
        <FieldContainer>
          <CheckBox
            label={t("course-closed")}
            checked={isClosed}
            onChange={(checked) => {
              if (checked) {
                setValue("closed_at", formatDateForDateTimeLocalInputs(new Date()) ?? null)
              } else {
                setValue("closed_at", null)
              }
            }}
          />
        </FieldContainer>
        {isClosed && (
          <>
            <FieldContainer>
              <DateTimeLocal label={t("closed-at")} {...register("closed_at")} />
            </FieldContainer>
            <FieldContainer>
              <TextAreaField
                label={t("closed-additional-message")}
                {...register("closed_additional_message")}
              />
            </FieldContainer>
            <FieldContainer>
              <TextField
                label={t("closed-course-successor-id")}
                error={errors.closed_course_successor_id?.message}
                {...register("closed_course_successor_id", {
                  validate: (value) => {
                    if (!value) {
                      return true
                    }
                    return validateUUID(value) || t("invalid-uuid-format")
                  },
                })}
              />
            </FieldContainer>
          </>
        )}
      </div>
    </StandardDialog>
  )
}

export default UpdateCourseForm
