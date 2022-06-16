import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { postNewChapter, updateChapter } from "../../../../../../services/backend/chapters"
import { Chapter, NewChapter } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import CheckboxFieldWrapper from "../../../../../../shared-module/components/InputFields/CheckboxFieldWrapper"
import DateTimeLocal from "../../../../../../shared-module/components/InputFields/DateTimeLocal"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import { dateToDateTimeLocalString } from "../../../../../../shared-module/utils/time"

interface NewChapterFormProps {
  courseId: string
  onSubmitForm: () => void
  chapterNumber: number
  initialData: Chapter | null
  newRecord: boolean
}

interface Fields {
  name: string
  opens_at: Date | null
  deadline: Date | null
  chapter_number: number
}

const NewChapterForm: React.FC<NewChapterFormProps> = ({
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
      return updateChapter(initialData?.id, data)
    },
    { notify: true, method: "POST" },
    { onSuccess: () => onSubmitForm() },
  )

  const deadlineRegister = register("deadline", { valueAsDate: true, required: false })
  const opensAtRegister = register("opens_at", { valueAsDate: true, required: false })

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        submitMutation.mutate({
          course_id: courseId,
          name: data.name,
          chapter_number: chapterNumber,
          front_page_id: null,
          opens_at: data.opens_at,
          deadline: data.deadline,
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
        register={register("name", { required: true })}
      />
      <TextField
        error={errors["chapter_number"]?.message}
        placeholder={t("text-field-label-chapter-number")}
        label={t("text-field-label-chapter-number")}
        type="number"
        register={register("chapter_number", {
          required: true,
          valueAsNumber: true,
          disabled: !newRecord,
        })}
      />
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
          register={opensAtRegister}
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
          register={deadlineRegister}
        />
      </CheckboxFieldWrapper>
      <div>
        <Button variant="primary" size="medium" disabled={!isValid || isSubmitting}>
          {newRecord ? t("button-text-create") : t("button-text-update")}
        </Button>
      </div>
    </form>
  )
}

export default NewChapterForm
