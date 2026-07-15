"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { FormProvider, useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  getCourseAudiencesOptions,
  getCoursePrerequisitesOptions,
  getSisuCourseLlmDescriptionsOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { updateMetadata } from "@/generated/api/sdk.generated"
import type { Course, CourseMetadataUpdate } from "@/generated/api/types.generated"
// import TextField from "@/shared-module/common/components/InputFields/TextField"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import { undefinedToNull } from "@/shared-module/common/utils/nullability"
import { QueryResult, TextArea, TextField } from "@/shared-module/components"
import { Button, Checkbox } from "@/shared-module/components/"
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
      build: (value) =>
        getSisuCourseLlmDescriptionsOptions({
          path: {
            course_id: value,
          },
        }),
    }),
  )

  const prerequisitesQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: open,
      build: (id) =>
        getCoursePrerequisitesOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )

  const audiencesQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: open,
      build: (id) =>
        getCourseAudiencesOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )

  const hasAudiences = audiencesQuery.data !== undefined && audiencesQuery.data?.length > 0

  const hasPrerequisites =
    prerequisitesQuery.data !== undefined && prerequisitesQuery.data?.length > 0

  const methods = useForm<
    CourseMetadataUpdate & {
      useSuggestedDescription: boolean
      useSuggestedPrerequisites: boolean
      useSuggestedAudiences: boolean
    }
  >({
    defaultValues: {
      course_description: "",
      course_audiences: [],
      course_prerequisites: [],
      useSuggestedDescription: true,
      useSuggestedPrerequisites: true,
      useSuggestedAudiences: true,
    },
  })

  const { control, handleSubmit, setValue } = methods

  useEffect(() => {
    if (sisuQuery.data) {
      setValue("course_description", sisuQuery.data.course_description)
      setValue(
        "course_audiences",
        sisuQuery.data.audience.map((audience) => ({
          audience,
        })),
      )
      if (sisuQuery.data.modules[0] === undefined) {
        console.log("WHAT THE HELLY")
      } else {
        setValue(
          "course_prerequisites",
          sisuQuery.data.modules[0].prerequisites.map((prerequisite) => ({
            prerequisite,
          })),
        )
      }
    }
  }, [sisuQuery.data, setValue])

  //const course_preqs = watch("course_prerequisites")

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
    updateCourseMetadataMutation.mutate({
      course_description: undefinedToNull(
        data.useSuggestedDescription ? data.course_description : course.description,
      ),
      course_prerequisites: data.useSuggestedPrerequisites
        ? data.course_prerequisites
        : (prerequisitesQuery.data ?? []),
      course_audiences: data.useSuggestedAudiences
        ? data.course_audiences
        : (audiencesQuery.data ?? []),
    })
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
            disabled:
              sisuQuery.isFetching ||
              sisuQuery.isError ||
              prerequisitesQuery.isFetching ||
              prerequisitesQuery.isError ||
              audiencesQuery.isFetching ||
              audiencesQuery.isError,
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
                  <div
                    className={css`
                      display: flex;
                      align-items: center;
                    `}
                  >
                    <HelpText>{t("fieldset-helptext-current")}</HelpText>
                    <div
                      data-testid="container-suggested-description"
                      className={css`
                        margin-left: auto;
                      `}
                    >
                      <Checkbox
                        control={control}
                        label={t("use-suggestion")}
                        name={"useSuggestedDescription"}
                      />
                    </div>
                  </div>

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
                  <div
                    className={css`
                      display: flex;
                      align-items: center;
                    `}
                  >
                    <HelpText>{t("fieldset-helptext-current")}</HelpText>
                    <div
                      data-testid="container-suggested-prerequisites"
                      className={css`
                        margin-left: auto;
                      `}
                    >
                      <Checkbox
                        label={t("use-suggestion")}
                        control={control}
                        name={"useSuggestedPrerequisites"}
                      />
                    </div>
                  </div>

                  {prerequisitesQuery.isFetching ? (
                    <Spinner />
                  ) : prerequisitesQuery.isError ? (
                    <ErrorBanner error={prerequisitesQuery.error} />
                  ) : hasPrerequisites ? (
                    <div>
                      {prerequisitesQuery.data?.map((preq, idx) => (
                        <li
                          key={idx}
                          className={css`
                            list-style-type: none;
                          `}
                        >
                          {preq.prerequisite}
                        </li>
                      ))}
                    </div>
                  ) : (
                    <div>{t("course-has-no-prerequisites")}</div>
                  )}
                  <div
                    className={css`
                      margin-top: 1rem;
                      margin-bottom: 0.5rem;
                    `}
                  >
                    <span
                      className={css`
                        font-weight: 500;
                      `}
                    >
                      {t("suggested-prerequisites-title")}
                    </span>
                  </div>

                  {prereqField.map((item, idx) => (
                    <div
                      key={item.id}
                      className={css`
                        display: flex;
                        flex-flow: row nowrap;
                      `}
                    >
                      <TextField
                        className={css`
                          flex-grow: 1;
                        `}
                        control={control}
                        name={`course_prerequisites.${idx}.prerequisite`}
                        label={t("text-field-label-prerequisites", { index: idx + 1 })}
                      />
                      <Button
                        className={css`
                          height: fit-content;
                          margin: 1rem;
                          padding: 0.5rem;
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
                  <div
                    className={css`
                      display: flex;
                      align-items: center;
                    `}
                  >
                    <Button
                      className={css`
                        margin-top: 0.5rem;
                      `}
                      size="medium"
                      type="button"
                      variant="secondary"
                      onClick={() => appendPrereq({ prerequisite: "" })}
                    >
                      {t("add-new-prerequisite")}
                    </Button>
                  </div>
                </FieldSet>
                <FieldSet>
                  <Legend>{t("audiences-fieldset-title")}</Legend>
                  <div
                    className={css`
                      display: flex;
                      align-items: center;
                    `}
                  >
                    <HelpText>{t("fieldset-helptext-current")}</HelpText>
                    <div
                      data-testid="container-suggested-audiences"
                      className={css`
                        margin-left: auto;
                      `}
                    >
                      <Checkbox
                        label={t("use-suggestion")}
                        control={control}
                        name={"useSuggestedAudiences"}
                      />
                    </div>
                  </div>
                  {audiencesQuery.isFetching ? (
                    <Spinner />
                  ) : audiencesQuery.isError ? (
                    <ErrorBanner error={audiencesQuery.error} />
                  ) : hasAudiences ? (
                    <div>
                      {audiencesQuery.data?.map((audience, idx) => (
                        <li
                          key={idx}
                          className={css`
                            list-style-type: none;
                          `}
                        >
                          {audience.audience}
                        </li>
                      ))}
                    </div>
                  ) : (
                    <div>{t("course-has-no-audiences")}</div>
                  )}
                  <div
                    className={css`
                      margin-top: 1rem;
                      margin-bottom: 0.5rem;
                    `}
                  >
                    <span
                      className={css`
                        font-weight: 500;
                      `}
                    >
                      {t("suggested-audiences-title")}
                    </span>
                  </div>

                  {audienceField.map((item, idx) => (
                    <div
                      key={item.id}
                      className={css`
                        display: flex;
                        flex-flow: row nowrap;
                      `}
                    >
                      <TextField
                        className={css`
                          flex-grow: 1;
                        `}
                        control={control}
                        name={`course_audiences.${idx}.audience`}
                        label={t("text-field-label-audiences", { index: idx + 1 })}
                      />
                      <Button
                        className={css`
                          height: fit-content;
                          margin: 1rem;
                          padding: 0.5rem;
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
                    className={css`
                      margin-top: 0.5rem;
                    `}
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
