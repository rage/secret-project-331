"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useEffect, useMemo, useRef } from "react"
import { FormProvider, useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import type {
  Course,
  CourseMetadataUpdate,
  SisuDescriptionResponse,
  CoursePrerequisite,
  CourseAudience,
} from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { undefinedToNull } from "@/shared-module/common/utils/nullability"
import { nullIfEmptyString } from "@/shared-module/common/utils/strings"
import { Button, Checkbox, nullIfEmpty, TextArea, TextField } from "@/shared-module/components/"

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

interface EditCourseMetadataData extends CourseMetadataUpdate {
  useSuggestedDescription: boolean
  useSuggestedPrerequisites: boolean
  useSuggestedAudiences: boolean
}

const buildFormValues = (
  course: Course,
  sisuData: SisuDescriptionResponse,
  prereqIds: string[],
  audienceIds: string[],
): EditCourseMetadataData => {
  return {
    course_description: sisuData.course_description,
    course_audiences: sisuData.audience.map((audience, idx) => ({
      id: audienceIds[idx] ?? v4(),
      course_id: course.id,
      audience,
    })),
    course_prerequisites: (sisuData.modules[0]?.prerequisites ?? []).map((prerequisite, idx) => ({
      id: prereqIds[idx] ?? v4(),
      course_id: course.id,
      prerequisite,
    })),
    useSuggestedDescription: true,
    useSuggestedPrerequisites: true,
    useSuggestedAudiences: true,
  }
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

  const removedPrereqIds = useRef<string[]>([])
  const removedAudienceIds = useRef<string[]>([])
  const initialPrereqIds = useMemo(() => prerequisites.map((p) => p.id), [prerequisites])
  const initialAudienceIds = useMemo(() => audiences.map((a) => a.id), [audiences])

  const methods = useForm<EditCourseMetadataData>({
    defaultValues: buildFormValues(course, sisuData, initialPrereqIds, initialAudienceIds),
  })

  const { control, handleSubmit, getValues, reset } = methods

  useEffect(() => {
    reset(buildFormValues(course, sisuData, initialPrereqIds, initialAudienceIds))

    const mappedPrereqIds = getValues("course_prerequisites").map((p) => p.id)
    const mappedAudiencedIds = getValues("course_audiences").map((a) => a.id)

    removedPrereqIds.current = initialPrereqIds.filter((p) => !mappedPrereqIds.includes(p))
    removedAudienceIds.current = initialAudienceIds.filter((a) => !mappedAudiencedIds.includes(a))
  }, [reset, getValues, sisuData, course, initialPrereqIds, initialAudienceIds])

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

  const handlePrereqRemove = (idx: number) => {
    const prereq_id = getValues(`course_prerequisites.${idx}.id`)

    removedPrereqIds.current.push(prereq_id)
    removePrereq(idx)
  }

  const handlePrereqAppend = () => {
    const prereq_id = removedPrereqIds.current.pop()

    appendPrereq({
      id: prereq_id ?? v4(),
      course_id: course.id,
      prerequisite: "",
    })
  }

  const handleAudienceRemove = (idx: number) => {
    const audience_id = getValues(`course_audiences.${idx}.id`)

    removedAudienceIds.current.push(audience_id)
    removeAudience(idx)
  }

  const handleAudienceAppend = () => {
    const audience_id = removedAudienceIds.current.pop()

    appendAudience({
      id: audience_id ?? v4(),
      course_id: course.id,
      audience: "",
    })
  }

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
              rules={nullIfEmpty}
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
            <ul
              className={css`
                margin: 0;
                padding 0;
              `}
            >
              {prerequisites.map((preq, idx) => (
                <li
                  key={idx}
                  className={css`
                    list-style-type: none;
                    padding: 0.2rem 0;
                    padding-left: 1.25rem;
                    position: relative;

                    ::before {
                      content: "•";
                      position: absolute;
                      left: 0;
                      color: ${baseTheme.colors.green[600]};
                    }
                  `}
                >
                  {preq.prerequisite}
                </li>
              ))}
            </ul>
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
                flex-flow: row wrap;
              `}
            >
              <div
                className={css`
                  flex: 1 1 400px;
                `}
              >
                <TextField
                  className={css`
                    flex-grow: 1;
                  `}
                  control={control}
                  name={`course_prerequisites.${idx}.prerequisite`}
                  label={t("text-field-label-prerequisites", { index: idx + 1 })}
                  rules={{
                    ...nullIfEmpty,
                    validate: (value) => {
                      if (!nullIfEmptyString(value)) {
                        return t("field-cannot-be-empty")
                      }
                      return true
                    },
                  }}
                />
              </div>

              <Button
                className={css`
                  height: fit-content;
                  margin: 1rem;
                  padding: 0.5rem;
                `}
                size="small"
                type="button"
                variant="tertiary"
                onClick={() => handlePrereqRemove(idx)}
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
              onClick={() => handlePrereqAppend()}
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
            <ul
              className={css`
                margin: 0;
                padding 0;
              `}
            >
              {audiences.map((audience, idx) => (
                <li
                  key={idx}
                  className={css`
                    list-style-type: none;
                    padding: 0.2rem 0;
                    padding-left: 1.25rem;
                    position: relative;

                    ::before {
                      content: "•";
                      position: absolute;
                      left: 0;
                      color: ${baseTheme.colors.green[600]};
                    }
                  `}
                >
                  {audience.audience}
                </li>
              ))}
            </ul>
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
                flex-flow: row wrap;
              `}
            >
              <div
                className={css`
                  flex: 1 1 400px;
                `}
              >
                <TextField
                  className={css`
                    flex-grow: 1;
                  `}
                  control={control}
                  name={`course_audiences.${idx}.audience`}
                  label={t("text-field-label-audiences", { index: idx + 1 })}
                  rules={{
                    ...nullIfEmpty,
                    validate: (value) => {
                      if (!nullIfEmptyString(value)) {
                        return t("field-cannot-be-empty")
                      }
                      return true
                    },
                  }}
                />
              </div>

              <Button
                className={css`
                  height: fit-content;
                  margin: 1rem;
                  padding: 0.5rem;
                `}
                size="small"
                type="button"
                variant="tertiary"
                onClick={() => handleAudienceRemove(idx)}
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
            onClick={() => handleAudienceAppend()}
          >
            {t("add-new-audience")}
          </Button>
        </FieldSet>
      </form>
    </FormProvider>
  )
}

export default AIMetadataFormFields
