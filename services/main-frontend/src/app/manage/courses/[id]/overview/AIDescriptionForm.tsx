"use client"

import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import React, { useEffect } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { updateCourse } from "@/generated/api/sdk.generated"
import type { Course, UpdateCourseData } from "@/generated/api/types.generated"
import { getCourseMaterialSisuCourseLlmDescriptionsOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"

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

const AIDescriptionForm: React.FC<React.PropsWithChildren<EditCourseFormProps>> = ({
  course,
  onSubmitForm,
  open,
  onClose,
}) => {
  const { t } = useTranslation()
  const { error, data } = useQuery(
    getCourseMaterialSisuCourseLlmDescriptionsOptions({
      path: {
        course_id: course.id,
      },
    }),
  )

  useEffect(() => {
    if (data) {
      setValue("description", data.course_description)
    }
  }, [data])
  console.log(course.mod)
  const methods = useForm<EditCourseFormValues>({
    defaultValues: {
      name: course.name,
      description: course.description,
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
      closed_at: course.closed_at
        ? (formatDateForDateTimeLocalInputs(course.closed_at) ?? null)
        : null,
      closed_additional_message: course.closed_additional_message ?? null,
      closed_course_successor_id: course.closed_course_successor_id ?? null,
      set_course_closed_at: Boolean(course.closed_at),
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = methods

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
          description: data.description,
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
      <StandardDialog
        open={open}
        onClose={onClose}
        title={t("generate-ai-description")}
        buttons={[
          {
            onClick: onSubmit,
            children: t("button-text-replace-description"),
            variant: "primary",
            disabled: updateCourseMutation.isPending,
          },
        ]}
      >
        <div>
          <FieldContainer>{course.description}</FieldContainer>
          <FieldContainer>
            <TextAreaField
              label={t("text-field-label-ai-description")}
              {...register("description")}
            />
          </FieldContainer>
        </div>
      </StandardDialog>
    </FormProvider>
  )
}

export default AIDescriptionForm
