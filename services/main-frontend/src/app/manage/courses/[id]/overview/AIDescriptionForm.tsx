"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  getSisuCourseLlmDescriptionsOptions,
  updateCourseMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { Course, CourseUpdate } from "@/generated/api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { QueryResult, TextArea } from "@/shared-module/components"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

// Build defaults from the course, omitting flagged_answers_threshold when null so the numeric
// field starts empty (react-hook-form treats an absent key the same as undefined).
const buildDefaultFormValues = (source: Course) => {
  const { flagged_answers_threshold: flaggedAnswersThreshold, ...courseRest } = source
  return {
    ...courseRest,
    ...(flaggedAnswersThreshold !== null && flaggedAnswersThreshold !== undefined
      ? { flagged_answers_threshold: flaggedAnswersThreshold }
      : {}),
  }
}

interface EditCourseFormProps {
  course: Course
  onSubmitForm: () => void
  open: boolean
  onClose: () => void
}

const AIDescriptionForm: React.FC<React.PropsWithChildren<EditCourseFormProps>> = ({
  course,
  onSubmitForm,
  open,
  onClose,
}) => {
  const { t } = useTranslation()

  const courseId = course.id
  const sisuQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: open,
      build: (value) =>
        getSisuCourseLlmDescriptionsOptions({
          path: {
            course_id: value,
          },
        }),
    }),
  )

  const methods = useForm<CourseUpdate>({
    defaultValues: buildDefaultFormValues(course),
  })

  const { control, register, handleSubmit, setValue, reset } = methods

  useEffect(() => {
    reset(buildDefaultFormValues(course))
  }, [course, reset])

  // Populate the field once the Sisu-generated description loads. Keyed on the fetched data so it
  // does not re-run on every render and clobber the user's edits.
  useEffect(() => {
    if (sisuQuery.data) {
      setValue("description", sisuQuery.data.course_description)
    }
  }, [sisuQuery.data, setValue])

  const setUpdateCourseMutation = useToastMutationOptions(
    updateCourseMutation(),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        onSubmitForm()
        onClose()
      },
    },
  )

  const onSubmit = handleSubmit((data) => {
    setUpdateCourseMutation.mutate({
      body: {
        ...data,
      },
      path: {
        course_id: course.id,
      },
    })
  })

  return (
    <FormProvider {...methods}>
      <StandardDialog
        open={open}
        onClose={onClose}
        title={t("ai-description-form-title")}
        buttons={[
          {
            onClick: onSubmit,
            children: t("button-text-replace-description"),
            variant: "primary",
            disabled: sisuQuery.isFetching || sisuQuery.isError,
          },
        ]}
      >
        <div>
          <span
            className={css`
              font-weight: 500;
            `}
          >
            {t("current-course-description-title")}
          </span>
          <FieldContainer>{course.description}</FieldContainer>
          <QueryResult
            query={sisuQuery}
            renderBlockingError={({ error, retry: _retry }) => {
              return <ErrorBanner variant={"readOnly"} error={error} />
            }}
          >
            {(_data) => (
              <FieldContainer>
                <TextArea
                  control={control}
                  label={t("text-field-label-ai-description")}
                  autoResize={true}
                  {...register("description")}
                />
              </FieldContainer>
            )}
          </QueryResult>
        </div>
      </StandardDialog>
    </FormProvider>
  )
}

export default AIDescriptionForm
