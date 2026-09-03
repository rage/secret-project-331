"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { CourseInstance, CourseInstanceForm } from "@/generated/api/types.generated"
import TimePicker from "@/shared-module/common/components/InputFields/DateTimeLocal"
import { Button, TextField } from "@/shared-module/components"

interface FormProps {
  initialData: CourseInstance | null
  onSubmit: (form: CourseInstanceForm) => void
  onCancel: () => void
}

interface Fields {
  name: string
  description: string
  supportEmail: string
  teacherName: string
  teacherEmail: string
}

const NewCourseInstanceForm: React.FC<React.PropsWithChildren<FormProps>> = ({
  initialData,
  onSubmit,
  onCancel: _onCancel,
}) => {
  const { t } = useTranslation()
  const { control, handleSubmit } = useForm<Fields>({
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      supportEmail: initialData?.support_email || "",
      teacherName: initialData?.teacher_in_charge_name || "",
      teacherEmail: initialData?.teacher_in_charge_email || "",
    },
  })
  const [newOpeningTime, setNewOpeningTime] = useState(initialData?.starts_at || null)
  const [newClosingTime, setNewClosingTime] = useState(initialData?.ends_at || null)
  const onSubmitWrapper = handleSubmit((data) => {
    onSubmit({
      name: data.name || null,
      description: data.description || null,
      support_email: data.supportEmail || null,
      teacher_in_charge_name: data.teacherName,
      teacher_in_charge_email: data.teacherEmail,
      opening_time: newOpeningTime,
      closing_time: newClosingTime,
    })
  })

  return (
    <form onSubmit={onSubmitWrapper}>
      <TextField name="name" control={control} label={t("text-field-label-name")} />
      <TextField name="description" control={control} label={t("text-field-label-description")} />
      <TextField name="supportEmail" control={control} label={t("support-email")} />
      <TextField name="teacherName" control={control} label={t("teacher-in-charge-name")} />
      <TextField name="teacherEmail" control={control} label={t("teacher-in-charge-email")} />
      <TimePicker
        label={t("opening-time")}
        onChangeByValue={(time) => setNewOpeningTime(new Date(time).toISOString())}
        className={css`
          margin-bottom: 0.5rem;
        `}
      />
      <TimePicker
        label={t("closing-time")}
        onChangeByValue={(time) => setNewClosingTime(new Date(time).toISOString())}
        className={css`
          margin-bottom: 0.5rem;
        `}
      />
      <Button
        variant="primary"
        size="medium"
        type="submit"
        className={css`
          width: 100%;
        `}
      >
        {t("button-text-submit")}
      </Button>
    </form>
  )
}

export default NewCourseInstanceForm
