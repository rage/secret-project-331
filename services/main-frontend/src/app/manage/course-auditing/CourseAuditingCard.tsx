"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQueryClient } from "@tanstack/react-query"
import { FloppyDiskSave, Pencil, XmarkCircle } from "@vectopus/atlas-icons-react"
import { parseISO } from "date-fns"
import { useRef, useState } from "react"
import { FormProvider, useFieldArray, useForm, useFormState } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import {
  getCoursesForAuditingQueryKey,
  updateCourseAuditingDataMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseAuditingData,
  CourseAuditingDataUpdate,
  ModifiedModule,
} from "@/generated/api/types.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import { courseMaterialFrontPageHref } from "@/shared-module/common/utils/cross-routing"
import { manageCourseByIdRoute } from "@/shared-module/common/utils/routes"
import { nullIfEmptyString } from "@/shared-module/common/utils/strings"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"
import { Button, Link, nullIfEmpty, TextArea, TextField } from "@/shared-module/components"

import ContentDisplayBox from "./ContentDisplayBox"
import CourseMetadata from "./CourseMetadata"
import ClosedSectionFields from "./EditClosedFields"
import EditModuleFields from "./EditModuleFields"
import { contentRowStyles } from "./page"

const FieldSet = styled.fieldset`
  display: flex;
  flex-direction: column;
  margin-bottom: 1rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  border-radius: 4px;
  padding: 0.5rem 1rem;
  gap: 1rem;
`

const Legend = styled.legend`
  font-weight: 600;
  padding: 0 0.25rem;
`

const linkStyles = css`
  color: ${baseTheme.colors.green[700]};
  text-decoration: underline;
`

interface CourseAuditingCardProps {
  id: string
  courseAuditingData: CourseAuditingData
}

export interface EditModuleData extends ModifiedModule {
  override_completion_link: boolean
}

export interface EditCourseAuditingData extends CourseAuditingDataUpdate {
  set_course_closed_at: boolean
  modules: EditModuleData[]
}

export const buildFormValues = (data: CourseAuditingData): EditCourseAuditingData => {
  return {
    ...data,
    closed_at: data.closed_at ? (formatDateForDateTimeLocalInputs(data.closed_at) ?? null) : null,
    set_course_closed_at: Boolean(data.closed_at),
    modules: data.modules.map((module) => ({
      ...module,
      override_completion_link: Boolean(module.completion_registration_link_override),
    })),
  }
}

const CourseAuditingCard: React.FC<CourseAuditingCardProps> = ({ id, courseAuditingData }) => {
  const { confirm } = useDialog()
  const { t } = useTranslation()

  const [editing, setEditing] = useState<boolean>(false)
  const queryClient = useQueryClient()

  const methods = useForm<EditCourseAuditingData>({
    defaultValues: buildFormValues(courseAuditingData),
  })

  const defaultModuleUhCourseCode = courseAuditingData.modules.find(
    (module) => module.order_number === 0,
  )?.uh_course_code

  const { control, handleSubmit, reset, getValues } = methods
  const { isDirty } = useFormState({ control })

  // oxlint-disable-next-line i18next/no-literal-string
  const { fields: moduleFields } = useFieldArray({ control, name: "modules" })

  const {
    fields: prereqFields,
    append: appendPrereq,
    remove: removePrereq,

    // oxlint-disable-next-line i18next/no-literal-string
  } = useFieldArray({ control, name: "prerequisites" })

  const {
    fields: audienceFields,
    append: appendAudience,
    remove: removeAudience,
    // oxlint-disable-next-line i18next/no-literal-string
  } = useFieldArray({ control, name: "audiences" })

  const toggleEdit = () => {
    setEditing(!editing)
  }

  const cancelEdit = async () => {
    if (isDirty) {
      const confirmed = await confirm(
        t("course-auditing-edit-unsaved-dialog-message"),
        t("course-auditing-edit-unsaved-dialog-title"),
      )
      if (confirmed) {
        reset()
        updateMutation.reset()
        setEditing(!editing)
      }
    } else {
      reset()
      updateMutation.reset()
      setEditing(!editing)
    }
  }

  const onSubmit = handleSubmit((data: EditCourseAuditingData) => {
    updateMutation.mutateAsync({
      body: {
        ...data,
        description: nullIfEmptyString(data.description),
        closed_at: data.set_course_closed_at
          ? data.closed_at
            ? parseISO(data.closed_at).toISOString()
            : null
          : null,
        closed_additional_message: nullIfEmptyString(data.closed_additional_message),
        closed_course_successor_id: nullIfEmptyString(data.closed_course_successor_id),
        modules: data.modules.map((module) => ({
          ...module,
          uh_course_code: nullIfEmptyString(module.uh_course_code),
          completion_registration_link_override: module.override_completion_link
            ? nullIfEmptyString(module.completion_registration_link_override)
            : null,
        })),
      },
      path: {
        course_id: courseAuditingData.id,
      },
    })
  })

  const updateMutation = useToastMutationOptions(
    updateCourseAuditingDataMutation(),
    {
      method: "PUT",
      notify: true,
      successMessage: t("course-edited-successfully"),
      errorHeader: t("error-editing-course"),
    },
    {
      onSuccess: (updated: CourseAuditingData) => {
        reset(buildFormValues(updated))

        queryClient.setQueryData(getCoursesForAuditingQueryKey(), (old: CourseAuditingData[]) => {
          if (!old) {
            return []
          }
          return old.map((o) => (o.id === updated.id ? updated : o))
        })

        setEditing(false)
      },
      // onError: () => {
      //   showErrorNotification({
      //     message: t("course-auditing-update-error"),
      //   })
      //   setStatus(UpdateStatus.failed)
      //   window.setTimeout(() => {
      //     setStatus(UpdateStatus.none)
      //   }, 4000)
      // },
    },
  )

  const removedPrereqIds = useRef<string[]>([])

  const handlePrereqRemove = (idx: number) => {
    const prereq_id = getValues(`prerequisites.${idx}.id`)

    removedPrereqIds.current.push(prereq_id)
    removePrereq(idx)
  }

  const handlePrereqAppend = () => {
    const prereq_id = removedPrereqIds.current.pop()

    appendPrereq({
      id: prereq_id ?? v4(),
      course_id: courseAuditingData.id,
      prerequisite: "",
    })
  }

  const removedAudienceIds = useRef<string[]>([])

  const handleAudienceRemove = (idx: number) => {
    const audience_id = getValues(`audiences.${idx}.id`)

    removedAudienceIds.current.push(audience_id)
    removeAudience(idx)
  }

  const handleAudienceAppend = () => {
    const audience_id = removedAudienceIds.current.pop()

    appendAudience({
      id: audience_id ?? v4(),
      course_id: courseAuditingData.id,
      audience: "",
    })
  }

  return (
    <FormProvider {...methods}>
      <div
        key={id}
        className={css`
          padding: 1rem;
          border: 1px solid rgba(0, 0, 0, 0.12);
        `}
      >
        <div
          className={css`
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            line-height: 2rem;
            padding-bottom: 1.5rem;
            align-items: baseline;
          `}
        >
          <div>
            <h1
              className={css`
                font-weight: 400;
                font-size: 1.5rem;
              `}
            >
              {courseAuditingData.name}
            </h1>
            <div
              className={css`
                color: ${baseTheme.colors.gray[600]};
                font-size: 1rem;
                display: flex;
                flex-wrap: wrap;
                margin-top: 0.5rem;
              `}
            >
              {courseAuditingData.organization_name}
            </div>
          </div>

          {editing ? (
            <div
              className={css`
                display: flex;
                flex-direction: row;
              `}
            >
              <Button
                aria-label={t("button-text-save")}
                onClick={onSubmit}
                variant={"icon"}
                size={"small"}
              >
                <FloppyDiskSave size={25} />
              </Button>
              <Button
                aria-label={t("button-text-cancel")}
                onClick={cancelEdit}
                variant={"icon"}
                size={"small"}
              >
                <XmarkCircle size={25} />
              </Button>
            </div>
          ) : (
            <div
              className={css`
                display: flex;
                flex-direction: row;
              `}
            >
              <Button aria-label={t("edit")} onClick={toggleEdit} variant={"icon"} size={"small"}>
                <Pencil size={25} />
              </Button>
            </div>
          )}
        </div>
        {editing ? (
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
            `}
          >
            {updateMutation.isError && (
              <ErrorBanner error={updateMutation.error} variant="readOnly" />
            )}
            <TextArea
              control={control}
              label={t("text-field-label-description")}
              name={"description"}
              rules={nullIfEmpty}
              autoResize={true}
            />

            <FieldSet>
              <Legend>{t("prerequisites-fieldset-title")}</Legend>

              {prereqFields.map((prerequisite, idx) => (
                <div key={prerequisite.id} className={contentRowStyles}>
                  <div
                    className={css`
                      flex: 1 1 400px;
                    `}
                  >
                    <TextField
                      control={control}
                      label={t("text-field-label-prerequisites", { index: idx + 1 })}
                      name={`prerequisites.${idx}.prerequisite` as const}
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

              {audienceFields.map((audience, idx) => (
                <div key={audience.id} className={contentRowStyles}>
                  <div
                    className={css`
                      flex: 1 1 400px;
                    `}
                  >
                    <TextField
                      key={audience.id}
                      control={control}
                      label={t("text-field-label-audiences", { index: idx + 1 })}
                      name={`audiences.${idx}.audience` as const}
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

              <div
                className={css`
                  display: flex;
                `}
              >
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
              </div>
            </FieldSet>

            <ClosedSectionFields />

            {moduleFields.map((module, idx) => (
              <EditModuleFields key={module.id} control={control} module={module} idx={idx} />
            ))}
          </div>
        ) : (
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
            `}
          >
            <ContentDisplayBox
              label={t("text-field-label-description")}
              content={courseAuditingData.description}
            />

            <div className={contentRowStyles}>
              <ContentDisplayBox
                label={t("prerequisites-fieldset-title")}
                content={
                  courseAuditingData.prerequisites.length > 0 &&
                  courseAuditingData.prerequisites.map((prerequisite) => (
                    <ul
                      key={prerequisite.id}
                      className={css`
                        list-style: none;
                        padding: 0;
                        margin: 0;
                        font-size: 0.9rem;
                        line-height: 1.5;
                      `}
                    >
                      <li
                        className={css`
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
                        {prerequisite.prerequisite}
                      </li>
                    </ul>
                  ))
                }
              />
              <ContentDisplayBox
                label={t("audiences-fieldset-title")}
                content={
                  courseAuditingData.audiences.length > 0 &&
                  courseAuditingData.audiences.map((audience) => (
                    <ul
                      key={audience.id}
                      className={css`
                        list-style: none;
                        padding: 0;
                        margin: 0;
                        font-size: 0.9rem;
                        line-height: 1.5;
                      `}
                    >
                      <li
                        className={css`
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
                    </ul>
                  ))
                }
              />
            </div>
            <CourseMetadata
              courseId={courseAuditingData.id}
              defaultModuleUhCourseCode={defaultModuleUhCourseCode}
              reset={reset}
              courseAuditingData={courseAuditingData}
              queryClient={queryClient}
            />
            {courseAuditingData.closed_at ? (
              <div
                className={css`
                  display: flex;
                  flex-direction: column;
                  gap: 1rem;
                `}
              >
                <div className={contentRowStyles}>
                  <ContentDisplayBox
                    label={t("closed-at")}
                    content={<TimeComponent date={parseISO(courseAuditingData.closed_at)} />}
                  />
                  <ContentDisplayBox
                    label={t("closed-course-successor-id")}
                    content={courseAuditingData.closed_course_successor_id}
                  />
                </div>
                <ContentDisplayBox
                  label={t("closed-additional-message")}
                  content={courseAuditingData.closed_additional_message}
                />
              </div>
            ) : (
              <ContentDisplayBox label={t("closed-at")} />
            )}
            {courseAuditingData.modules.map((module) => (
              <div
                key={module.id}
                className={css`
                  display: flex;
                  flex-direction: column;
                  gap: 1rem;
                `}
              >
                <div
                  className={css`
                    font-size: 1.15rem;
                    font-weight: 600;
                    color: ${baseTheme.colors.gray[900]};
                    margin: 0.5rem 0rem;
                  `}
                >
                  {module.name ? `${module.order_number}. ${module.name}` : t("default-module")}
                </div>
                <ContentDisplayBox
                  label={t("completion-registration-link")}
                  content={module.completion_registration_link_override}
                />
                <div className={contentRowStyles}>
                  <ContentDisplayBox
                    label={t("label-enable-registering-completion-to-uh-open-university")}
                    content={
                      module.enable_registering_completion_to_uh_open_university
                        ? t("label-true")
                        : t("label-false")
                    }
                  />
                  <ContentDisplayBox label={t("uh-course-code")} content={module.uh_course_code} />
                  <ContentDisplayBox label={t("ects-credits")} content={module.ects_credits} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div
          className={css`
            display: flex;
            flex-flow: row wrap;
            align-items: normal;
            justify-content: space-between;
            gap: 1rem;
            margin-top: 1rem;
          `}
        >
          <TimeComponent
            label={t("label-created")}
            date={parseISO(courseAuditingData.created_at)}
            right={false}
            boldLabel
          />
          <TimeComponent
            label={t("label-updated")}
            date={parseISO(courseAuditingData.updated_at)}
            right={true}
            boldLabel
          />
          <Link
            className={linkStyles}
            href={courseMaterialFrontPageHref(
              courseAuditingData.organization_slug,
              courseAuditingData.slug,
            )}
          >
            {t("course-auditing-card-open-course-front-page")}
          </Link>
          <Link className={linkStyles} href={manageCourseByIdRoute(courseAuditingData.id)}>
            {t("course-auditing-card-open-course-overview")}
          </Link>
        </div>
      </div>
    </FormProvider>
  )
}

export default CourseAuditingCard
