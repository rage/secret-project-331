"use client"

"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { FormProvider, useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type {
  Course,
  CourseMetadataUpdate,
  SisuDescriptionResponse,
  CoursePrerequisite,
  CourseAudience,
} from "@/generated/api/types.generated"
// import TextField from "@/shared-module/common/components/InputFields/TextField"
import { baseTheme } from "@/shared-module/common/styles"
import { undefinedToNull } from "@/shared-module/common/utils/nullability"
import { TextArea, TextField } from "@/shared-module/components"
import { Button, Checkbox } from "@/shared-module/components/"

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

interface AIMetadataFormProps {
  course: Course
  sisuData: SisuDescriptionResponse
  prerequisites: CoursePrerequisite[]
  audiences: CourseAudience[]
  hasPrerequisites: boolean
  hasAudiences: boolean
  onSubmit: (data: CourseMetadataUpdate) => void
}

const AIMetadataFormFields: React.FC<React.PropsWithChildren<AIMetadataFormProps>> = ({
  course,
  sisuData,
  prerequisites,
  audiences,
  hasPrerequisites,
  hasAudiences,
  onSubmit,
}) => {
  const { t } = useTranslation()

  if (sisuData.modules[0] === undefined) {
    throw new Error("Course has no default module")
  }

  const methods = useForm<
    CourseMetadataUpdate & {
      useSuggestedDescription: boolean
      useSuggestedPrerequisites: boolean
      useSuggestedAudiences: boolean
    }
  >({
    defaultValues: {
      course_description: sisuData.course_description,
      course_audiences: sisuData.audience.map((audience) => ({
        audience,
      })),
      course_prerequisites: sisuData.modules[0].prerequisites.map((prerequisite) => ({
        prerequisite,
      })),
      useSuggestedDescription: true,
      useSuggestedPrerequisites: true,
      useSuggestedAudiences: true,
    },
  })
  console.log("SISUDATA PROPS: " + sisuData)
  console.log("PREREQUISITES PROPS: " + prerequisites)
  console.log("AUDIENCES PROPS: " + audiences)
  const { control, handleSubmit } = methods

  const {
    fields: prereqField,
    append: appendPrereq,
    remove: removePrereq,
    // oxlint-disable-next-line i18next/no-literal-string
  } = useFieldArray({ control, name: "course_prerequisites" })

  const {
    fields: audienceField,
    append: appendAudience,
    remove: removeAudience,
    // oxlint-disable-next-line i18next/no-literal-string
  } = useFieldArray({ control, name: "course_audiences" })

  const submit = handleSubmit((data) => {
    const coursePrerequisites = data.useSuggestedPrerequisites
      ? data.course_prerequisites
      : prerequisites

    const courseAudiences = data.useSuggestedAudiences ? data.course_audiences : audiences

    onSubmit({
      course_description: undefinedToNull(
        data.useSuggestedDescription ? data.course_description : course.description,
      ),
      course_prerequisites: coursePrerequisites,
      course_audiences: courseAudiences,
    })
  })

  return (
    <FormProvider {...methods}>
      <form id="ai-metadata-form" onSubmit={submit}>
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

          {hasPrerequisites ? (
            <div>
              {prerequisites.map((preq, idx) => (
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
          {hasAudiences ? (
            <div>
              {audiences.map((audience, idx) => (
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
      </form>
    </FormProvider>
  )
}

export default AIMetadataFormFields
