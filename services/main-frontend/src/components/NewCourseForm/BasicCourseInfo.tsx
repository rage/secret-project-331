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
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form
  const name = watch("name")

  useEffect(() => {
    if (name) {
      setValue("slug", normalizePath(name))
    }
  }, [name, setValue])

  return (
    <>
      <FieldContainer>
        <TextField
          required
          label={t("text-field-label-name")}
          error={errors.name?.message}
          {...register("name", {
            required: t("required-field"),
            minLength: {
              value: 3,
              message:
                t("text-field-label-name") +
                  ": " +
                  t("error-min-length", { count: 3, field: t("text-field-label-name") }) ||
                `${t("text-field-label-name")} must be at least 3 characters.`,
            },
          })}
        />
      </FieldContainer>
      <FieldContainer>
        <TextField
          required
          label={t("text-field-label-or-header-slug-or-short-name")}
          error={errors.slug?.message}
          {...register("slug", {
            required: t("required-field"),
            pattern: {
              value: /^[a-z0-9-]+$/,
              message: t("invalid-url"),
            },
            minLength: {
              value: 3,
              message:
                t("text-field-label-or-header-slug-or-short-name") +
                  ": " +
                  t("error-min-length", {
                    count: 3,
                    field: t("text-field-label-or-header-slug-or-short-name"),
                  }) ||
                `${t("text-field-label-or-header-slug-or-short-name")} must be at least 3 characters.`,
            },
          })}
        />
      </FieldContainer>
      <FieldContainer>
        <TextField
          required
          label={t("teacher-in-charge-name")}
          error={errors.teacher_in_charge_name?.message}
          {...register("teacher_in_charge_name", {
            required: t("required-field"),
            minLength: {
              value: 2,
              message:
                t("teacher-in-charge-name") +
                  ": " +
                  t("error-min-length", { count: 2, field: t("teacher-in-charge-name") }) ||
                `${t("teacher-in-charge-name")} must be at least 2 characters.`,
            },
          })}
        />
      </FieldContainer>
      <FieldContainer>
        <TextField
          required
          label={t("teacher-in-charge-email")}
          type="email"
          error={errors.teacher_in_charge_email?.message}
          {...register("teacher_in_charge_email", {
            required: t("required-field"),
            pattern: {
              value: /@/,
              message: t("enter-a-valid-email"),
            },
          })}
        />
      </FieldContainer>
      <FieldContainer>
        <TextAreaField label={t("text-field-label-description")} {...register("description")} />
      </FieldContainer>
    </>
  )
}

export default BasicCourseInfo
