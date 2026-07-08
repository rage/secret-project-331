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
import { baseTheme } from "@/shared-module/common/styles"
import { QueryResult, TextArea, TextField } from "@/shared-module/components"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const FieldSet = styled.fieldset`
  margin-bottom: 1rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  border-radius: 4px;
  padding: 0.5rem 1rem;
`

const Legend = styled.legend`
  font-weight: 600;
  padding: 0 0.25rem;
`

const HelpText = styled.p`
  margin: 0.25rem 0 0.5rem;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[500]};
`

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
        "course_audiences",
        sisuQuery.data.audience.map((audience) => ({
          audience,
        })),
      )
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
      course_audiences: [],
      course_prerequisites: [],
    },
  })

  console.log("SISUDATA: ", sisuQuery.data)

  const { control, register, handleSubmit, setValue, watch } = methods

  const course_preqs = watch("course_prerequisites")

  console.log("SET VALUE: ", course_preqs)

  const {
    fields: prereqField,
    append: appendPrereq,
    remove: removePrereq,
    // eslint-disable-next-line i18next/no-literal-string
  } = useFieldArray({ control, name: "course_prerequisites" })

  const {
    fields: audienceField,
    append: appendAudience,
    remove: removeAudience,
    // eslint-disable-next-line i18next/no-literal-string
  } = useFieldArray({ control, name: "course_audiences" })

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
        title={t("ai-metadata-form-title")}
        buttons={[
          {
            onClick: onSubmit,
            children: t("button-text-replace-metadata"),
            variant: "primary",
            disabled: sisuQuery.isFetching || sisuQuery.isError,
          },
        ]}
      >
        <div>
          <QueryResult
            query={sisuQuery}
            renderBlockingError={({ error, retry: _retry }) => {
              return <ErrorBanner variant={"readOnly"} error={error} />
            }}
          >
            {(_data) => (
              <>
                <FieldSet>
                  <Legend>{t("description-fieldset-title")}</Legend>
                  <HelpText>{t("fieldset-helptext-current")}</HelpText>
                  {/* <span
                    className={css`
                      font-weight: 500;
                    `}
                  >
                    {t("current-course-description-title")}
                  </span> */}
                  <FieldContainer>{course.description}</FieldContainer>

                  <FieldContainer>
                    <TextArea
                      control={control}
                      label={t("text-field-label-ai-description")}
                      autoResize={true}
                      name={"course_description"}
                    />
                  </FieldContainer>
                </FieldSet>
                <FieldSet>
                  <Legend>{t("prerequisites-fieldset-title")}</Legend>
                  <HelpText>{t("fieldset-helptext-current")}</HelpText>

                  {/* <span
                    className={css`
                      font-weight: 500;
                    `}
                  >
                    {t("current-prerequisites-title")}
                  </span> */}
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
                  {prereqField.map((item, idx) => (
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
                        onClick={() => removePrereq(idx)}
                      >
                        {t("button-remove")}
                      </Button>
                    </div>
                  ))}

                  <Button
                    size="medium"
                    type="button"
                    variant="secondary"
                    onClick={() => appendPrereq({ prerequisite: "" })}
                  >
                    {t("add-new-prerequisite")}
                  </Button>
                </FieldSet>
                <FieldSet>
                  <Legend>{t("audiences-fieldset-title")}</Legend>
                  <span
                    className={css`
                      font-weight: 500;
                    `}
                  >
                    {t("suggested-audiences-title")}
                  </span>
                  {audienceField.map((item, idx) => (
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
                        name={`course_audiences.${idx}.audience`}
                        label={t("text-field-label-audiences", { index: idx + 1 })}
                      />
                      <Button
                        className={css`
                          height: fit-content;
                          margin: 1rem;
                        `}
                        size="small"
                        type="button"
                        variant="tertiary"
                        onClick={() => removeAudience(idx)}
                      >
                        {t("button-remove")}
                      </Button>
                    </div>
                  ))}

                  <Button
                    size="medium"
                    type="button"
                    variant="secondary"
                    onClick={() => appendAudience({ audience: "" })}
                  >
                    {t("add-new-audience")}
                  </Button>
                </FieldSet>
              </>
            )}
          </QueryResult>
        </div>
      </StandardDialog>
    </FormProvider>
  )
}

export default AIDescriptionForm
