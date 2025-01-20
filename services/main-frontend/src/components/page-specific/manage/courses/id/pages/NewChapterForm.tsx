import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { postNewChapter, updateChapter } from "../../../../../../services/backend/chapters"

import { Chapter, NewChapter } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import CheckboxFieldWrapper from "@/shared-module/common/components/InputFields/CheckboxFieldWrapper"
import DateTimeLocal from "@/shared-module/common/components/InputFields/DateTimeLocal"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { dateToDateTimeLocalString } from "@/shared-module/common/utils/time"

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
  opens_at: string | null
  deadline: string | null
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
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    setValue,
    getValues,
  } = useForm<Fields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      name: "",
      color: null,
      chapter_number: chapterNumber,
      opens_at: null,
      deadline: null,
      ...initialData,
    },
  })

  const submitMutation = useToastMutation(
    (data: NewChapter) => {
      // Temp solution to retain module information without having a way to edit modules in frontend yet.
      data.course_module_id = initialData?.course_module_id ?? null
      if (newRecord) {
        return postNewChapter(data)
      }
      if (!initialData?.id) {
        // eslint-disable-next-line i18next/no-literal-string
        throw new Error("No id for chapter")
      }
      return updateChapter(initialData?.id, {
        ...data,
        course_module_id: initialData.course_module_id,
      })
    },
    { notify: true, method: "POST" },
    { onSuccess: () => onSubmitForm() },
  )

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        submitMutation.mutate({
          course_id: courseId,
          name: data.name,
          color: data.color,
          chapter_number: chapterNumber,
          front_page_id: null,
          opens_at: data.opens_at ?? null,
          deadline: data.deadline ?? null,
          course_module_id: null,
        })
      })}
      className={css`
        padding: 1rem 0;
      `}
    >
      <TextField
        error={errors["name"]?.message}
        placeholder={t("text-field-label-name")}
        label={t("text-field-label-name")}
        {...register("name", { required: "required-field" })}
      />
      <TextField
        error={errors["chapter_number"]?.message}
        placeholder={t("text-field-label-chapter-number")}
        label={t("text-field-label-chapter-number")}
        type="number"
        {...register("chapter_number", {
          required: t("required-field"),
          valueAsNumber: true,
          disabled: !newRecord,
        })}
      />
      <CheckboxFieldWrapper
        initialChecked={!!getValues("color")}
        fieldName={t("input-field-chapter-color")}
        onUncheck={() => setValue("color", null)}
      >
        <TextField
          className={css`
            height: 45px;
            padding: 0px 0px 0px 0px !important;
          `}
          error={errors["color"]?.message}
          placeholder={t("input-field-chapter-color")}
          label={t("input-field-chapter-color")}
          {...register("color", { required: false })}
          type="color"
        />
      </CheckboxFieldWrapper>
      <CheckboxFieldWrapper
        initialChecked={!!getValues("opens_at")}
        fieldName={t("label-opens-at")}
        onUncheck={() => setValue("opens_at", null)}
      >
        <DateTimeLocal
          error={errors["opens_at"]?.message}
          defaultValue={
            initialData?.opens_at ? dateToDateTimeLocalString(initialData?.opens_at) : undefined
          }
          placeholder={t("label-opens-at")}
          label={t("label-opens-at")}
          {...register("opens_at", { valueAsDate: true, required: false })}
        />
      </CheckboxFieldWrapper>
      <CheckboxFieldWrapper
        initialChecked={!!getValues("deadline")}
        fieldName={t("label-deadline")}
        onUncheck={() => setValue("deadline", null)}
      >
        <DateTimeLocal
          error={errors["deadline"]?.message}
          defaultValue={
            initialData?.deadline ? dateToDateTimeLocalString(initialData?.deadline) : undefined
          }
          placeholder={t("label-deadline")}
          label={t("label-deadline")}
          {...register("deadline", { valueAsDate: true, required: false })}
        />
      </CheckboxFieldWrapper>
      <div>
        <Button variant="primary" size="medium" fullWidth disabled={!isValid || isSubmitting}>
          {newRecord ? t("button-text-create") : t("button-text-update")}
        </Button>
      </div>
    </form>
  )
}

export default NewChapterForm
