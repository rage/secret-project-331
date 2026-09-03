"use client"

import { css } from "@emotion/css"
import React from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  createChapterMutation as createChapterMutationOptions,
  updateChapterMutation as updateChapterMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { Chapter, NewChapter } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { dateToDateTimeLocalString } from "@/shared-module/common/utils/time"
import { Button, Checkbox, DateTimeLocalField, TextField } from "@/shared-module/components"

interface NewChapterFormProps {
  courseId: string
  onSubmitForm: () => void
  chapterNumber: number
  initialData: Chapter | null
  newRecord: boolean
}

interface Fields {
  name: string
  color: string | null
  has_color: boolean
  opens_at: string | null
  has_opens_at: boolean
  deadline: string | null
  has_deadline: boolean
  chapter_number: number
}

const NewChapterForm: React.FC<React.PropsWithChildren<NewChapterFormProps>> = ({
  courseId,
  onSubmitForm,
  chapterNumber,
  initialData,
  newRecord,
}) => {
  const { t } = useTranslation()
  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
  } = useForm<Fields>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      name: "",
      color: null,
      chapter_number: chapterNumber,
      ...initialData,
      opens_at: initialData?.opens_at ? dateToDateTimeLocalString(initialData.opens_at) : null,
      deadline: initialData?.deadline ? dateToDateTimeLocalString(initialData.deadline) : null,
      has_color: Boolean(initialData?.color),
      has_opens_at: Boolean(initialData?.opens_at),
      has_deadline: Boolean(initialData?.deadline),
    },
  })

  // oxlint-disable-next-line i18next/no-literal-string
  const hasColor = useWatch({ name: "has_color", control })
  // oxlint-disable-next-line i18next/no-literal-string
  const hasOpensAt = useWatch({ name: "has_opens_at", control })
  // oxlint-disable-next-line i18next/no-literal-string
  const hasDeadline = useWatch({ name: "has_deadline", control })

  const createChapterMutation = useToastMutationOptions(
    createChapterMutationOptions(),
    { notify: true, method: "POST" },
    { onSuccess: () => onSubmitForm() },
  )
  const updateChapterMutation = useToastMutationOptions(
    updateChapterMutationOptions(),
    { notify: true, method: "PUT" },
    { onSuccess: () => onSubmitForm() },
  )
  const isPending = createChapterMutation.isPending || updateChapterMutation.isPending

  const submitForm = async (data: NewChapter) => {
    if (newRecord) {
      await createChapterMutation.mutateAsync({
        body: {
          ...data,
          // Temp solution to retain module information without having a way to edit modules in frontend yet.
          course_module_id: initialData?.course_module_id ?? null,
        },
      })
      return
    }

    if (!initialData?.id) {
      throw new Error("No id for chapter")
    }

    await updateChapterMutation.mutateAsync({
      path: {
        chapter_id: initialData.id,
      },
      body: {
        ...data,
        course_module_id: initialData.course_module_id,
      },
    })
  }

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        await submitForm({
          course_id: courseId,
          name: data.name,
          color: data.has_color ? data.color : null,
          chapter_number: chapterNumber,
          front_page_id: null,
          opens_at:
            data.has_opens_at && data.opens_at ? new Date(data.opens_at).toISOString() : null,
          deadline:
            data.has_deadline && data.deadline ? new Date(data.deadline).toISOString() : null,
          course_module_id: null,
        })
      })}
      className={css`
        padding: 1rem 0;
      `}
    >
      <TextField
        name="name"
        control={control}
        label={t("text-field-label-name")}
        rules={{ required: t("required-field") }}
      />
      <TextField
        name="chapter_number"
        control={control}
        label={t("text-field-label-chapter-number")}
        type="number"
        isDisabled={!newRecord}
        rules={{ required: t("required-field") }}
      />
      <Checkbox
        name="has_color"
        control={control}
        label={t("set-field-value", { name: t("input-field-chapter-color") })}
      />
      {hasColor && (
        <TextField
          className={css`
            height: 45px;
            padding: 0px 0px 0px 0px !important;
          `}
          name="color"
          control={control}
          label={t("input-field-chapter-color")}
          type="color"
        />
      )}
      <Checkbox
        name="has_opens_at"
        control={control}
        label={t("set-field-value", { name: t("label-opens-at") })}
      />
      {hasOpensAt && (
        <DateTimeLocalField
          name="opens_at"
          control={control}
          data-testid="chapter-opens-at-field"
          label={t("label-opens-at")}
        />
      )}
      <Checkbox
        name="has_deadline"
        control={control}
        label={t("set-field-value", { name: t("label-deadline") })}
      />
      {hasDeadline && (
        <DateTimeLocalField
          name="deadline"
          control={control}
          data-testid="chapter-deadline-field"
          label={t("label-deadline")}
        />
      )}
      <div>
        <Button
          type="submit"
          variant="primary"
          size="medium"
          disabled={!isValid || isSubmitting || isPending}
          className={css`
            width: 100%;
          `}
        >
          {newRecord ? t("button-text-create") : t("button-text-update")}
        </Button>
      </div>
    </form>
  )
}

export default NewChapterForm
