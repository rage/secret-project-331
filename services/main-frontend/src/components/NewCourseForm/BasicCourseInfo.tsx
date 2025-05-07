import React, { useEffect } from "react"
import { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { FieldContainer, FormFields } from "."

import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { normalizePath } from "@/utils/normalizePath"

interface BasicCourseInfoProps {
  form: UseFormReturn<FormFields>
}

const BasicCourseInfo: React.FC<BasicCourseInfoProps> = ({ form }) => {
  const { t } = useTranslation()
  const { register, watch, setValue } = form
  const name = watch("name")

  useEffect(() => {
    if (name) {
      setValue("slug", normalizePath(name))
    }
  }, [name, setValue])

  return (
    <>
      <FieldContainer>
        <TextField required label={t("text-field-label-name")} {...register("name")} />
      </FieldContainer>
      <FieldContainer>
        <TextField
          required
          label={t("text-field-label-or-header-slug-or-short-name")}
          {...register("slug")}
        />
      </FieldContainer>
      <FieldContainer>
        <TextField
          required
          label={t("teacher-in-charge-name")}
          {...register("teacher_in_charge_name")}
        />
      </FieldContainer>
      <FieldContainer>
        <TextField
          required
          label={t("teacher-in-charge-email")}
          type="email"
          {...register("teacher_in_charge_email")}
        />
      </FieldContainer>
      <FieldContainer>
        <TextAreaField label={t("text-field-label-description")} {...register("description")} />
      </FieldContainer>
    </>
  )
}

export default BasicCourseInfo
