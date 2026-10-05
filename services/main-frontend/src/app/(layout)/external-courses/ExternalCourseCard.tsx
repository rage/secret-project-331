"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import { FloppyDiskSave, Pencil, XmarkCircle } from "@vectopus/atlas-icons-react"
import { parseISO } from "date-fns"
import React, { useRef, useState } from "react"
import {
  FormProvider,
  useFieldArray,
  useForm,
  useFormState,
  useWatch,
  type Control,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import {
  getCoursesForAuditingQueryKey,
  getExternalCoursesQueryKey,
  updateCourseAuditingDataMutation,
  updateExternalCourseMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  ExternalCourseOutput,
  CourseAuditingDataUpdate,
  CourseAuditingModuleUpdate,
} from "@/generated/api/types.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import { courseMaterialFrontPageHref } from "@/shared-module/common/utils/cross-routing"
import { nullIfFalsy, omitUndefined } from "@/shared-module/common/utils/nullability"
import { manageCourseByIdRoute } from "@/shared-module/common/utils/routes"
import { nullIfEmptyString } from "@/shared-module/common/utils/strings"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"
import { Button, Link, nullIfEmpty, TextArea, TextField } from "@/shared-module/components"

import ContentDisplayBox from "../manage/course-auditing/CourseCard/ContentDisplayBox"

const linkStyles = css`
  color: ${baseTheme.colors.green[700]};
  text-decoration: underline;
`

interface ExternalCourseCardProps {
  externalCourse: ExternalCourseOutput
}

export const buildFormValues = (data: ExternalCourseOutput): ExternalCourseOutput => data

const ExternalCourseCard: React.FC<ExternalCourseCardProps> = ({ externalCourse }) => {
  const { confirm } = useDialog()
  const { t } = useTranslation()
  const methods = useForm<ExternalCourseOutput>({
    defaultValues: buildFormValues(externalCourse),
  })
  const { control, handleSubmit, reset, getValues } = methods

  const { isDirty } = useFormState({ control })

  const [editing, setEditing] = useState<boolean>(false)
  const queryClient = useQueryClient()
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

  const onSubmit = handleSubmit(async (data: ExternalCourseOutput) => {
    await updateMutation.mutateAsync({
      body: {
        id: data.id,
        name: data.name,
        description: nullIfEmptyString(data.description),
        url: data.url,
      },
    })
  })
  const updateMutation = useToastMutationOptions(
    updateExternalCourseMutation(),
    {
      method: "PUT",
      notify: true,
      successMessage: t("course-edited-successfully"),
      errorHeader: t("error-editing-course"),
    },
    {
      onSuccess: (updated: ExternalCourseOutput) => {
        reset(buildFormValues(updated))

        queryClient.setQueryData(getExternalCoursesQueryKey(), (old: ExternalCourseOutput[]) => {
          if (!old) {
            return []
          }
          return old.map((o) => (o.id === updated.id ? updated : o))
        })

        setEditing(false)
      },
    },
  )

  return (
    <FormProvider {...methods}>
      <div
        key={externalCourse.id}
        className={css`
          padding: 1rem;
          border: 1px solid rgba(0, 0, 0, 0.12);
        `}
        data-testid="course-auditing-card"
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
              {externalCourse.name}
            </h1>
            <div
              className={css`
                color: ${baseTheme.colors.gray[600]};
                font-size: 1rem;
                display: flex;
                flex-wrap: wrap;
                margin-top: 0.5rem;
              `}
            ></div>
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
                onClick={() => void onSubmit()}
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
        <div
          className={css`
            display: flex;
            flex-direction: column;
            gap: 1rem;
          `}
        >
          <ContentDisplayBox
            label={t("text-field-label-description")}
            content={externalCourse.description}
          />
        </div>
        <div
          className={css`
            display: flex;
            flex-direction: column;
            gap: 1rem;
          `}
        >
          <ContentDisplayBox label={t("text-field-label-url")} content={externalCourse.url} />
        </div>
      </div>
    </FormProvider>
  )
}

export default ExternalCourseCard
