"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import { FloppyDiskSave, Pencil, Trash, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { FormProvider, useForm, useFormState } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  deleteExternalCourseMutation,
  getExternalCoursesQueryKey,
  updateExternalCourseMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { ExternalCourseOutput } from "@/generated/api/types.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import { nullIfEmptyString } from "@/shared-module/common/utils/strings"
import { Button, Checkbox, nullIfEmpty, TextArea } from "@/shared-module/components"

import ContentDisplayBox from "../manage/course-auditing/CourseCard/ContentDisplayBox"

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
  const { control, handleSubmit, reset } = methods

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

  const deleteContent = async () => {
    const confirmed = await confirm(
      t("delete-external-course-confirmation", { name: externalCourse.name }),
      t("button-text-delete"),
    )
    if (confirmed) {
      await deleteMutation.mutateAsync({
        body: externalCourse,
      })
    }
  }

  const onSubmit = handleSubmit(async (data: ExternalCourseOutput) => {
    await updateMutation.mutateAsync({
      body: {
        id: data.id,
        name: data.name,
        description: nullIfEmptyString(data.description),
        url: data.url,
        on_old_platform: data.on_old_platform,
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
  const deleteMutation = useToastMutationOptions(
    deleteExternalCourseMutation(),
    { notify: false },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getExternalCoursesQueryKey(),
        })
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
        data-testid="external-course-card"
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
              {editing ? t("course-plans-current-stage-edit-label") : externalCourse.name}
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
              <Button
                aria-label={t("button-text-delete")}
                onClick={() => void deleteContent()}
                variant={"icon"}
                size={"small"}
              >
                <Trash size={25} />
              </Button>

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
              label={t("text-field-label-name")}
              name={"name"}
              rules={nullIfEmpty}
              autoResize={true}
            />
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

            {updateMutation.isError && (
              <ErrorBanner error={updateMutation.error} variant="readOnly" />
            )}
            <TextArea
              control={control}
              label={t("text-field-label-url")}
              name={"url"}
              rules={nullIfEmpty}
              autoResize={true}
            />
            <Checkbox
              control={control}
              label={t("external-course-form-old-platform")}
              name={"on_old_platform"}
            />
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
              content={externalCourse.description}
            />

            <ContentDisplayBox label={t("text-field-label-url")} content={externalCourse.url} />
          </div>
        )}
      </div>
    </FormProvider>
  )
}

export default ExternalCourseCard
