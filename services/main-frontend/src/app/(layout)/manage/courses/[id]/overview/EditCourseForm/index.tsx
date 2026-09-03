"use client"

import styled from "@emotion/styled"
import { parseISO } from "date-fns"
import React, { useEffect } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { updateCourse } from "@/generated/api/sdk.generated"
import type { Course, UpdateCourseData } from "@/generated/api/types.generated"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"
import { Checkbox, Dialog, TextArea, TextField } from "@/shared-module/components"

import AiPolicyFields from "./AiPolicyFields"
import ClosedSectionFields from "./ClosedSectionFields"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface EditCourseFormProps {
  course: Course
  onSubmitForm: () => void
  open: boolean
  onClose: () => void
}

type CourseUpdateBody = UpdateCourseData["body"]

export type EditCourseFormValues = CourseUpdateBody & { set_course_closed_at: boolean }

const buildFormValues = (course: Course): EditCourseFormValues => ({
  name: course.name,
  description: course.description ?? null,
  is_draft: course.is_draft,
  is_test_mode: course.is_test_mode,
  is_unlisted: course.is_unlisted,
  can_add_chatbot: course.can_add_chatbot,
  is_joinable_by_code_only: course.is_joinable_by_code_only,
  ask_marketing_consent: course.ask_marketing_consent,
  chapter_locking_enabled: course.chapter_locking_enabled,
  flagged_answers_threshold: course.flagged_answers_threshold ?? 3,
  flagged_answers_skip_manual_review_and_allow_retry:
    course.flagged_answers_skip_manual_review_and_allow_retry,
  closed_at: course.closed_at ? (formatDateForDateTimeLocalInputs(course.closed_at) ?? null) : null,
  closed_additional_message: course.closed_additional_message ?? null,
  closed_course_successor_id: course.closed_course_successor_id ?? null,
  set_course_closed_at: Boolean(course.closed_at),
  ai_policy: course.ai_policy,
  course_material_ai_instructions: course.course_material_ai_instructions ?? null,
})

const EditCourseForm: React.FC<React.PropsWithChildren<EditCourseFormProps>> = ({
  course,
  onSubmitForm,
  open,
  onClose,
}) => {
  const { t } = useTranslation()

  const methods = useForm<EditCourseFormValues>({
    defaultValues: buildFormValues(course),
  })

  const { control, handleSubmit, watch, reset } = methods

  useEffect(() => {
    reset(buildFormValues(course))
  }, [course, reset])

  const draftStatus = watch("is_draft")

  const updateCourseMutation = useToastMutation(
    async (data: EditCourseFormValues) => {
      let unlisted = data.is_unlisted
      if (data.is_draft) {
        // Course cannot be unlisted if it is a draft. Draft courses are not displayed to students.
        unlisted = false
      }
      await updateCourse({
        body: {
          name: data.name,
          ...omitUndefined({ description: data.description }),
          is_draft: data.is_draft,
          is_test_mode: data.is_test_mode,
          is_unlisted: unlisted,
          can_add_chatbot: data.can_add_chatbot,
          is_joinable_by_code_only: data.is_joinable_by_code_only,
          ask_marketing_consent: data.ask_marketing_consent,
          chapter_locking_enabled: data.chapter_locking_enabled,
          flagged_answers_threshold: data.flagged_answers_threshold,
          flagged_answers_skip_manual_review_and_allow_retry:
            data.flagged_answers_skip_manual_review_and_allow_retry,
          closed_at: data.set_course_closed_at
            ? data.closed_at
              ? parseISO(data.closed_at).toISOString()
              : null
            : null,
          closed_additional_message: data.closed_additional_message || null,
          closed_course_successor_id: data.closed_course_successor_id || null,
          ai_policy: data.ai_policy,
          ...omitUndefined({
            course_material_ai_instructions: data.course_material_ai_instructions,
          }),
        },
        path: {
          course_id: course.id,
        },
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
    <FormProvider {...methods}>
      <Dialog
        open={open}
        onClose={onClose}
        title={t("edit-course")}
        actions={[
          {
            onClick: onSubmit,
            label: t("button-text-update"),
            variant: "primary",
            disabled: updateCourseMutation.isPending,
          },
        ]}
      >
        <div>
          <FieldContainer>
            <TextField
              isRequired
              name="name"
              control={control}
              label={t("text-field-label-name")}
              rules={{ required: t("required-field") }}
            />
          </FieldContainer>
          <FieldContainer>
            <TextArea
              name="description"
              control={control}
              label={t("text-field-label-description")}
            />
          </FieldContainer>
          <FieldContainer>
            <Checkbox name="is_draft" control={control} label={t("draft")} />
          </FieldContainer>

          {!draftStatus && (
            <FieldContainer>
              <Checkbox name="is_unlisted" control={control} label={t("unlisted")} />
            </FieldContainer>
          )}
          <FieldContainer>
            <Checkbox name="is_test_mode" control={control} label={t("test-course")} />
          </FieldContainer>
          <OnlyRenderIfPermissions
            action={{ type: "teach" }}
            resource={{ type: "global_permissions" }}
          >
            <FieldContainer>
              <Checkbox name="can_add_chatbot" control={control} label={t("can-enable-chatbot")} />
            </FieldContainer>
          </OnlyRenderIfPermissions>
          <FieldContainer>
            <Checkbox
              name="is_joinable_by_code_only"
              control={control}
              label={t("joinable-by-code-only")}
            />
          </FieldContainer>
          <FieldContainer>
            <Checkbox
              name="ask_marketing_consent"
              control={control}
              label={t("label-ask-for-marketing-consent")}
            />
          </FieldContainer>
          <FieldContainer>
            <Checkbox
              name="chapter_locking_enabled"
              control={control}
              label={t("label-chapter-locking-enabled")}
            />
          </FieldContainer>
          <FieldContainer>
            <TextField
              type={"number"}
              min={0}
              // oxlint-disable-next-line i18next/no-literal-string
              step="1"
              name="flagged_answers_threshold"
              control={control}
              label={t("label-threshold-to-move-flagged-answer-to-manual-review")}
              rules={{
                min: { value: 0, message: t("threshold-must-be-non-negative") },
              }}
            />
          </FieldContainer>
          <FieldContainer>
            <Checkbox
              name="flagged_answers_skip_manual_review_and_allow_retry"
              control={control}
              label={t("label-flagged-answers-skip-manual-review-and-allow-retry")}
            />
          </FieldContainer>

          <AiPolicyFields />

          <ClosedSectionFields />
        </div>
      </Dialog>
    </FormProvider>
  )
}

export default EditCourseForm
