"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { updateCourse } from "@/generated/api/sdk.generated"
import type { Course, CourseUpdate } from "@/generated/api/types.generated"
import { getCourseMaterialSisuCourseLlmDescriptionsOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { QueryResult, TextArea } from "@/shared-module/components"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

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
      build: (courseId) =>
        getCourseMaterialSisuCourseLlmDescriptionsOptions({
          path: {
            course_id: courseId,
          },
        }),
    }),
  )

  useEffect(() => {
    if (sisuQuery.data) {
      setValue("description", sisuQuery.data.course_description)
    }
  })

  const methods = useForm<CourseUpdate>({
    defaultValues: {
      ...course,
      flagged_answers_threshold: course.flagged_answers_threshold ?? undefined,
    },
  })

  const { control, register, handleSubmit, setValue, reset } = methods

  useEffect(() => {
    reset({
      ...course,
      flagged_answers_threshold: course.flagged_answers_threshold ?? undefined,
    })
  }, [course, reset])

  const updateCourseMutation = useToastMutation(
    async (data: CourseUpdate) => {
      await updateCourse({
        body: {
          ...data,
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
