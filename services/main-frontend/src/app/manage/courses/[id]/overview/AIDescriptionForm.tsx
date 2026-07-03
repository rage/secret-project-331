"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getSisuCourseLlmDescriptionsOptions } from "@/generated/api/@tanstack/react-query.generated"
import { updateCourse, updateMetadata } from "@/generated/api/sdk.generated"
import type { Course, CourseMetadataUpdate, CourseUpdate } from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
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
        getSisuCourseLlmDescriptionsOptions({
          path: {
            course_id: courseId,
          },
        }),
    }),
  )

  useEffect(() => {
    if (sisuQuery.data) {
      setValue("course_description", sisuQuery.data.course_description)
      setValue("course_prerequisites", sisuQuery.data.modules[0].prerequisites)
    }
  })
  //sisuQuery.data?.modules[0].course_description
  const methods = useForm<CourseMetadataUpdate>({
    defaultValues: {
      // eslint-disable-next-line i18next/no-literal-string
      course_description: "testi",
      // eslint-disable-next-line i18next/no-literal-string
      course_prerequisites: ["213", "testi"],
    },
  })
  console.log("METHODS: ", methods)
  const { control, register, handleSubmit, setValue, reset } = methods

  // useEffect(() => {
  //   reset({
  //     ...course,
  //   })
  // }, [course, reset])

  const updateCourseMetadataMutation = useToastMutation(
    async (data: CourseMetadataUpdate) => {
      console.log("DATA: ", data)
      await updateMetadata({
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
    { method: "POST", notify: true },
  )

  const onSubmit = handleSubmit((data) => {
    updateCourseMetadataMutation.mutate(data)
    console.log("DATA IN onSubmit: ", data)
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
            {(data) => (
              <>
                <FieldContainer>
                  <TextArea
                    control={control}
                    label={t("text-field-label-ai-description")}
                    autoResize={true}
                    {...register("course_description")}
                  />
                </FieldContainer>
                <TextField
                  label={t("text-field-label-prerequisites")}
                  {...register("course_prerequisites")}
                />
                {data.modules[0].prerequisites.map((prerequisite, index) => (
                  // <TextField label={t("text-field-label-prerequisites")} {...prerequisite} />
                  <li key={index}>{prerequisite}</li>
                ))}
              </>
            )}
          </QueryResult>
        </div>
      </StandardDialog>
    </FormProvider>
  )
}

export default AIDescriptionForm
