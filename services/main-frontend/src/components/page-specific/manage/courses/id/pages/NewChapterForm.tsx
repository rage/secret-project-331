import { css } from "@emotion/css"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { postNewChapter } from "../../../../../../services/backend/chapters"
import { Chapter } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import CheckboxFieldWrapper from "../../../../../../shared-module/components/InputFields/CheckboxFieldWrapper"
import DateTimeLocal from "../../../../../../shared-module/components/InputFields/DateTimeLocal"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"
import { dateToString } from "../../../../../../shared-module/utils/time"

interface NewChapterFormProps {
  courseId: string
  onSubmitForm: () => void
  chapterNumber: number
  initialData: Chapter | null
}

interface Fields {
  name: string
  opens_at: Date
  deadline: Date
}

const NewChapterForm: React.FC<NewChapterFormProps> = ({
  courseId,
  onSubmitForm,
  chapterNumber,
  initialData,
}) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<Fields>({ defaultValues: { opens_at: new Date() } })
  const [chapter, setChapter] = useState<number | undefined>(chapterNumber)
  const [name, setName] = useState<string>("")

  const createNewChapter = async () => {
    if (chapter !== undefined) {
      await postNewChapter({
        course_id: courseId,
        name: name,
        chapter_number: chapter,
        front_front_page_id: null,
      })
      onSubmitForm()
    }
  }

  return (
    <form
      onSubmit={handleSubmit(createNewChapter)}
      className={css`
        padding: 1rem 0;
      `}
    >
      <TextField
        error={errors["name"]?.message}
        defaultValue={initialData?.name}
        placeholder={t("text-field-label-name")}
        label={t("text-field-label-name")}
        register={register("name", { required: true })}
      />
      <CheckboxFieldWrapper fieldName={"Opens at"}>
        <DateTimeLocal
          error={errors["opens_at"]?.message}
          defaultValue={initialData?.name}
          placeholder={"Opens at"}
          label={"Opens at"}
          value={dateToString(getValues()["opens_at"])}
          register={register("opens_at", { required: true })}
        />
      </CheckboxFieldWrapper>
      <div>
        <Button variant="primary" size="medium" onClick={createNewChapter}>
          {t("button-text-create")}
        </Button>
      </div>
    </form>
  )
}

export default NewChapterForm
