"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { FormProvider, useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  getCoursePrerequisitesOptions,
  getSisuCourseLlmDescriptionsOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { updateMetadata } from "@/generated/api/sdk.generated"
import type { Course, CourseMetadataUpdate } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
// import TextField from "@/shared-module/common/components/InputFields/TextField"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { QueryResult, TextArea, TextField } from "@/shared-module/components"
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

  const prerequisitesQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: open,
      build: (courseId) =>
        getCoursePrerequisitesOptions({
          path: {
            course_id: courseId,
          },
        }),
    }),
  )

  const hasPrerequisites =
    prerequisitesQuery.data !== undefined && prerequisitesQuery.data?.length > 0

  useEffect(() => {
    if (sisuQuery.data) {
      setValue("course_description", sisuQuery.data.course_description)
      setValue(
        "course_prerequisites",
        sisuQuery.data.modules[0].prerequisites.map((prerequisite) => ({
          prerequisite,
        })),
      )
    }
  }, [sisuQuery.data])

  const methods = useForm<CourseMetadataUpdate>({
    defaultValues: {
      course_description: "",

      course_prerequisites: [
        {
          prerequisite: "",
        },
      ],
    },
  })

  const { control, register, handleSubmit, setValue } = methods

  // eslint-disable-next-line i18next/no-literal-string
  const { fields, append, remove } = useFieldArray({ control, name: "course_prerequisites" })

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
            {(_data) => (
              <>
                <FieldContainer>
                  <TextArea
                    control={control}
                    label={t("text-field-label-ai-description")}
                    autoResize={true}
                    name={"course_description"}
                  />
                </FieldContainer>
                {/* <div
                  className={css`
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                  `}
                > */}
                <span
                  className={css`
                    font-weight: 500;
                  `}
                >
                  {t("current-prerequisites-title")}
                </span>
                {hasPrerequisites ? (
                  <div>
                    {prerequisitesQuery.data?.map((preq, idx) => (
                      <li key={idx}>{preq.prerequisite}</li>
                    ))}
                  </div>
                ) : (
                  <div>{t("course-has-no-prerequisites")}</div>
                )}

                <span
                  className={css`
                    font-weight: 500;
                  `}
                >
                  {t("suggested-prerequisites-title")}
                </span>
                {fields.map((item, idx) => (
                  <div
                    key={idx}
                    className={css`
                      display: flex;
                      flex-flow: row nowrap;
                      gap: 1.5rem;
                    `}
                  >
                    <TextField
                      className={css`
                        flex-grow: 1;
                        margin: 0.5rem;
                      `}
                      key={idx}
                      control={control}
                      name={`course_prerequisites.${idx}.prerequisite`}
                      label={t("text-field-label-prerequisites", { index: idx + 1 })}
                    />
                    <Button
                      className={css`
                        height: fit-content;
                        margin: 1rem;
                      `}
                      size="small"
                      type="button"
                      variant="tertiary"
                      onClick={() => remove(idx)}
                    >
                      {t("button-remove")}
                    </Button>
                  </div>
                ))}

                <Button
                  size="medium"
                  type="button"
                  variant="secondary"
                  onClick={() => append({ prerequisite: "" })}
                >
                  {t("add-new-prerequisite")}
                </Button>
                {/* </div> */}
              </>
            )}
          </QueryResult>
        </div>
      </StandardDialog>
    </FormProvider>
  )
}

export default AIDescriptionForm
